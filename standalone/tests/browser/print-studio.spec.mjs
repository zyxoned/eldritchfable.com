import {expect,test} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {studio} from '../../print-studio/service.mjs';

test('a customer can submit a built-in design and a Firefox OBJ download without renaming it',async({page})=>{
  const db=new DatabaseSync(':memory:');
  const config={ottoKey:'fixture',origin:''};
  const registered=[],sent=[];
  const otto=async(path,body)=>{
    if(path==='/files'){
      registered.push(body.filename);
      return {id:'file_'+'a'.repeat(32),upload:{method:'POST',url:'https://storage.example.test/upload',fields:{}}};
    }
    if(path==='/models')return {id:'MD-0000000'+registered.length};
    throw Error('Unexpected OTTO call '+path);
  };
  const sendStorage=async(url,options)=>{
    expect(url).toBe('https://storage.example.test/upload');
    const file=options.body.get('file');
    expect(await file.text()).toContain('v ');
    sent.push(file.name);
    return new Response(null,{status:204});
  };
  const server=studio({db,otto,config,sendStorage,identity:async()=>({id:'test-buyer',role:'customer'})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  config.origin='http://127.0.0.1:'+server.address().port;
  try{
    const crossOrigin=[];
    page.on('request',req=>{if(req.url().startsWith('https://storage.'))crossOrigin.push(req.url());});
    await page.goto(config.origin+'/print-studio/#design');
    await page.getByRole('combobox',{name:'Shape'}).selectOption('star');
    await page.getByRole('button',{name:'Use for my print'}).click();
    await expect(page.locator('#chosen')).toContainText('star-40mm-6mm.obj');
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'Submit for inspection'}).click();
    await expect(page.locator('#uploadFeedback')).toContainText('Submitted MD-00000001');
    await page.locator('input[type=file]').setInputFiles({name:'hexagon-40mm-6mm.obj.txt',mimeType:'text/plain',
      buffer:Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')});
    await expect(page.locator('#chosen')).toContainText('Using hexagon-40mm-6mm.obj as a 3D model');
    await page.getByRole('button',{name:'Submit for inspection'}).click();
    await expect(page.locator('#uploadFeedback')).toContainText('Submitted MD-00000002');
    expect(registered).toEqual(['star-40mm-6mm.obj','hexagon-40mm-6mm.obj']);
    expect(sent).toEqual(registered);
    expect(crossOrigin).toEqual([]);
    await page.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('notes')});
    await page.getByRole('button',{name:'Submit for inspection'}).click();
    await expect(page.locator('#uploadFeedback')).toContainText('Plain text files cannot be printed');
    expect(registered).toHaveLength(2);
  }finally{
    await new Promise(resolve=>server.close(resolve));db.close();
  }
});
