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

test('guests and customers use the same workbench, with private tools confined to the merchant view',async({page})=>{
  const db=new DatabaseSync(':memory:');
  const model='MD-00000001';
  const config={ottoKey:'fixture',origin:''};
  const server=studio({db,config,identity:async()=>({id:'owner',role:'admin'}),otto:async(path)=>{
    if(path==='/models/'+model) return {id:model,status:'ready',longest_dimension_mm:80,print_check:{result:{decision:'printable'}}};
    if(path==='/quotes')return {id:'quote-fixture',status:'open',currency:'usd',expires_at:new Date(Date.now()+60_000).toISOString(),
      items:[{model_id:model,quantity:1,subtotal:5415}],shipping_options:[
        {id:'express',name:'Express',totals:{shipping:1118,total:6533}},
        {id:'ground',name:'Ground',totals:{shipping:700,total:6115}}]};
    throw Error('Unexpected provider request');
  }});
  db.prepare('INSERT INTO models(id,owner,name,mm) VALUES(?,?,?,?)').run(model,'owner','Test Warden',80);
  db.prepare('INSERT INTO settings VALUES(?,?)').run('custom_markup',1300);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));config.origin='http://127.0.0.1:'+server.address().port;
  const requests=[];page.on('request',req=>requests.push(new URL(req.url()).pathname));
  try{
    await page.goto(config.origin+'/print-studio/?view=guest');
    await expect(page.locator('#status')).toContainText('Checkout is paused');
    const canvas=page.locator('#drawing');await canvas.focus();
    const initial=await canvas.getAttribute('aria-description');await canvas.press('ArrowRight');
    await expect(canvas).not.toHaveAttribute('aria-description',initial);
    await page.getByRole('button',{name:'Zoom in'}).click();await expect(canvas).toHaveAttribute('aria-description',/120 percent/);
    await page.getByRole('button',{name:'Wireframe'}).click();await expect(page.locator('#wire')).toHaveAttribute('aria-pressed','true');
    await page.getByRole('link',{name:'My prints',exact:true}).click();
    await expect(page.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
    expect(requests).not.toContain('/api/otto/me');
    await page.goto(config.origin+'/print-studio/?view=customer#library');
    await expect(page.getByText('Test Warden')).toBeVisible();
    await expect(page.getByRole('link',{name:'Merchant workspace'})).toHaveCount(0);
    await page.getByRole('button',{name:'Check print and shipping'}).click();
    const form=page.locator('#address');
    for(const [name,value] of Object.entries({name:'Example buyer',line1:'123 Example St',city:'Example City',state:'ky',postal_code:'40202'}))await form.locator('[name='+name+']').fill(value);
    await page.getByRole('button',{name:'Get shipping options'}).click();
    await expect(page.getByRole('radio',{name:/Ground/})).toBeChecked();
    await expect(page.getByText('$74.15')).toBeVisible();
    await page.getByRole('radio',{name:/Express/}).check();await expect(page.getByText('$78.33')).toBeVisible();
    await expect(page.getByRole('button',{name:'Continue to Stripe'})).toHaveCount(0);
    await form.locator('[name=postal_code]').fill('40203');await expect(page.locator('#rates')).toBeEmpty();
    expect(requests.filter(path=>path.includes('/admin/'))).toEqual([]);
    await page.goto(config.origin+'/print-studio/#merchant');
    await expect(page.getByRole('link',{name:'View as customer'})).toBeVisible();
    await expect(page.locator('#connections')).toContainText('checkout paused');
  }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
