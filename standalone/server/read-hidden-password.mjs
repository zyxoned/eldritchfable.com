import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';

// Never echo credentials to terminal output or accept an accidentally piped secret.
export async function readHiddenPassword(prompt, { input = stdin, output = stdout } = {}) {
  if (!input.isTTY || !output.isTTY) throw Error('Admin provisioning requires an interactive terminal');
  const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const rl = createInterface({ input, output: muted, terminal: true });
  try {
    output.write(prompt);
    return await new Promise((resolve, reject) => {
      rl.once('SIGINT', () => reject(Error('Password entry cancelled')));
      rl.once('close', () => reject(Error('Password entry cancelled')));
      rl.question('', resolve);
    });
  } finally {
    rl.close();
    muted.end();
    output.write('\n');
  }
}
