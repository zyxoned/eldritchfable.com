from pathlib import Path
import datetime, hashlib, json, os, re, shutil, subprocess, sys
os.umask(0o022)
ROOT=Path('/srv/eldritch-staging/rpg-release-7c5068bdb17b')
commit=sys.argv[1]
assert re.fullmatch('[0-9a-f]{40}',commit)
def run(*args): return subprocess.check_output(args,cwd=ROOT,text=True).strip()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
assert run('git','rev-parse','HEAD')==commit,'CHECKOUT_NOT_RELEASE'
assert not run('git','status','--porcelain'),'SOURCE_NOT_CLEAN'
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
release='welcome-'+commit[:12]+'-'+stamp
bundle=Path('/srv/eldritch-staging/rollout-'+release)
bundle.mkdir()
old=Path('/srv/eldritch-staging/rollout-tavern-0f058552e8f5-20261026T132056Z')
dist=bundle/'frontend'
shutil.copytree(ROOT/'standalone/dist',dist)
previous=Path('/srv/eldritch-production/frontend')
retained=[]
for source in (previous/'assets').iterdir():
 target=dist/'assets'/source.name
 if not target.exists():
  shutil.copyfile(source,target)
  retained.append(str(target.relative_to(dist)))
 else: assert sha(source)==sha(target),'ASSET_COLLISION'
assets=re.findall(r'(?:src|href)="(/assets/[^"]+)"',(dist/'index.html').read_text())
assert len(assets)>=2 and all((dist/a.lstrip('/')).is_file() for a in assets)
previousApp=os.readlink('/srv/eldritch-production/app')
manifest={'releaseId':release,'frontendCommit':commit,'backendRelease':Path(previousApp).name,'builtAssets':assets}
(dist/'frontend-release.json').write_text(json.dumps(manifest,indent=2)+'\n')
config=Path('/etc/caddy/eldritch-accounts-production.json')
candidate=json.loads(config.read_text())
headers=candidate['apps']['http']['servers']['srv0']['routes'][0]['handle'][0]['response']['set']
assert headers['X-Eldritch-Release']==[manifest['backendRelease']]
headers['X-Eldritch-Frontend-Release']=[release]
(bundle/'caddy-candidate.json').write_text(json.dumps(candidate,indent=2)+'\n')
run('git','bundle','create',str(bundle/'source.bundle'),'HEAD')
plan={**manifest,'bundle':str(bundle),'sourceBranch':'feature/account-rpg-secret-stash',
 'sourceTree':run('git','rev-parse','HEAD^{tree}'),'sourceBundleSha256':sha(bundle/'source.bundle'),
 'previousFrontend':os.readlink(previous),'previousApp':previousApp,
 'configPath':str(config),'originalConfigSha256':sha(config),
 'candidateConfigSha256':sha(bundle/'caddy-candidate.json'),
 'files':{str(p.relative_to(dist)):sha(p) for p in sorted(dist.rglob('*')) if p.is_file()},
 'retainedAssets':retained}
(bundle/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
deploy=(old/'deploy-frontend.py').read_text().replace(str(old),str(bundle)).replace(
 "['/account','/login','/register','/resend-verification']",
 "['/account','/login','/register','/resend-verification','/play','/stash']")
rollback=(old/'rollback-frontend.py').read_text().replace('tavern-0f058552e8f5-20261026T132056Z',release)
(bundle/'deploy-frontend.py').write_text(deploy)
(bundle/'rollback-frontend.py').write_text(rollback)
compile(deploy,str(bundle/'deploy-frontend.py'),'exec')
compile(rollback,str(bundle/'rollback-frontend.py'),'exec')
Path('/srv/eldritch-staging/adventure-welcome-rollout-plan-path').write_text(str(bundle))
print(json.dumps({'status':'prepared','releaseId':release,'frontendCommit':commit,'bundle':str(bundle),'previousFrontend':plan['previousFrontend'],'backendPreserved':plan['previousApp'],'retainedAssets':retained,'files':len(plan['files'])}))
