#!/usr/bin/env python3
"""Restore one historical source snapshot to a new, private directory only."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess

PROTECTED = ('/etc', '/var', '/proc', '/sys', '/dev', '/boot', '/run', '/usr',
             '/bin', '/sbin', '/lib', '/lib64', '/mnt/eldritch-data',
             '/srv/eldritch-production', '/srv/eldritch-fable',
             '/srv/eldritch-staging/app', '/srv/eldritch-staging/frontend',
             '/srv/eldritch-staging/data', '/srv/eldritch-staging/backups')


def relative_path(value):
    if not isinstance(value, str) or '\\' in value or '\x00' in value:
        raise ValueError('Invalid relative source path')
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or '..' in path.parts or str(path) != value:
        raise ValueError('Unsafe relative source path')
    if any(part in ('.git', 'node_modules', 'dist', 'data', 'backups') for part in path.parts):
        raise ValueError('Runtime or metadata path is not restorable')
    name = path.name.lower()
    if name.startswith('.env') or name.endswith(('.pem', '.key', '.p12', '.pfx', '.db', '.sqlite', '.sqlite3', '-wal', '-shm')):
        raise ValueError('Sensitive or runtime filename is not restorable')
    return Path(*path.parts)


def new_destination(value, archive):
    requested = Path(value).expanduser().absolute()
    if requested.exists() or requested.is_symlink():
        raise ValueError('Destination must not already exist')
    parent = requested.parent.resolve(strict=True)
    if not parent.is_dir():
        raise ValueError('Destination parent must be an existing directory')
    destination = parent / requested.name
    for prefix in map(Path, PROTECTED):
        if destination == prefix or prefix in destination.parents:
            raise ValueError('Destination is inside a protected runtime path')
    if destination == archive or archive in destination.parents:
        raise ValueError('Destination cannot be inside the preservation archive')
    for ancestor in (parent, *parent.parents):
        if (ancestor / '.git').exists():
            raise ValueError('Destination cannot be inside an existing Git worktree')
    return destination


def read_content(item, archive, repository):
    blob = item['gitBlob']
    if not re.fullmatch(r'[0-9a-f]{40}', blob):
        raise ValueError('Invalid immutable Git blob identity')
    storage = item['storage']
    if storage['kind'] == 'historical-copy':
        source = archive / relative_path(storage['path'])
        if source.is_symlink() or archive not in source.resolve(strict=True).parents:
            raise ValueError('Historical copy escapes its archive')
        data = source.read_bytes()
    elif storage['kind'] == 'existing-git-blob':
        environment = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
        result = subprocess.run(['git', '-c', 'safe.directory=' + str(repository),
                                 '-C', str(repository), 'cat-file', 'blob', blob],
                                env=environment, capture_output=True)
        if result.returncode:
            raise ValueError('Required immutable Git blob is unavailable: ' + blob)
        data = result.stdout
    else:
        raise ValueError('Unknown content storage kind')
    identity = hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()
    if (identity != blob or len(data) != item['bytes'] or
            hashlib.sha256(data).hexdigest() != item['sha256']):
        raise ValueError('Content integrity check failed: ' + blob)
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', nargs='?')
    parser.add_argument('destination', nargs='?')
    parser.add_argument('--list', action='store_true', help='List preserved snapshot IDs')
    parser.add_argument('--repository', type=Path,
                        default=Path(__file__).resolve().parents[2],
                        help='Repository containing the immutable existing blobs')
    args = parser.parse_args()
    archive = Path(__file__).resolve().parent
    manifest = json.loads((archive / 'manifest.json').read_text())
    sources = {source['id']: source for source in manifest['sources']}
    if args.list:
        for key, source in sources.items():
            print(key + ' (' + str(len(source['files'])) + ' files)')
        return
    if args.snapshot not in sources or not args.destination:
        parser.error('Supply a listed snapshot ID and a new destination, or use --list')
    try:
        destination = new_destination(args.destination, archive)
        repository = args.repository.resolve(strict=True)
        content = {item['gitBlob']: item for item in manifest['contents']}
        prepared, cache, names = [], {}, set()
        for entry in sources[args.snapshot]['files']:
            path = relative_path(entry['path'])
            if path in names:
                raise ValueError('Duplicate destination filename')
            names.add(path)
            if not re.fullmatch(r'0[0-7]{3}', entry['mode']):
                raise ValueError('Unsafe file permission mode')
            blob = entry['content']
            if blob not in cache:
                cache[blob] = read_content(content[blob], archive, repository)
            prepared.append((path, cache[blob], int(entry['mode'], 8), content[blob]['sha256']))
        # All paths, bytes, identities and modes pass before the destination exists.
        destination.mkdir(mode=0o700)
        for path, data, mode, checksum in prepared:
            target = destination / path
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0)
            with os.fdopen(os.open(target, flags, 0o600), 'wb') as stream:
                stream.write(data)
            target.chmod(mode)
            if (hashlib.sha256(target.read_bytes()).hexdigest() != checksum or
                    stat.S_IMODE(target.stat().st_mode) != mode):
                raise ValueError('Restored file verification failed')
        print(json.dumps({'snapshot': args.snapshot, 'destination': str(destination),
                          'verifiedFiles': len(prepared)}))
    except (OSError, KeyError, ValueError) as error:
        parser.exit(1, 'Restore refused or stopped: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
