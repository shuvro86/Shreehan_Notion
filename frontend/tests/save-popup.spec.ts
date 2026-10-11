import {test,expect} from '@playwright/test';

test.skip(process.env.E2E_CLASSROOM!=='1','Requires the isolated classroom fixture.');

test('dashboard and board saves show confirmation after persistence',async({browser})=>{
 const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL});
 await context.request.post('/api/auth/login',{data:{username:'classroom_student',password:'classroom-test'}});
 const page=await context.newPage();
 await page.goto('/');
 await page.getByRole('button',{name:'Add task',exact:true}).click();
 await page.getByLabel('What would you like to work on?').fill('Read a fresh story');
 await page.getByRole('button',{name:'Create task'}).click();
 await expect(page.getByRole('status').filter({hasText:'Your task list was saved.'})).toBeVisible();
 await page.goto('/kanban');
 await page.getByRole('button',{name:'Rename Ideas'}).click();
 const name=page.getByRole('textbox',{name:'Column name'});
 await name.fill('Fresh ideas');
 await name.press('Enter');
 await expect(page.getByRole('status').filter({hasText:'Board changes saved.'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Fresh ideas',exact:true})).toBeVisible();
 await context.close();
});

test('admin menu save shows confirmation',async({browser})=>{
 const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL});
 await context.request.post('/api/auth/login',{data:{username:'shuvro',password:'classroom-test'}});
 const page=await context.newPage();
 await page.goto('/admin');
 await page.getByRole('button',{name:'Menu access'}).click();
 const control=page.getByRole('checkbox',{name:'student Document library'});
 const original=await control.isChecked();
 if(original)await control.uncheck();else await control.check();
 await expect(page.locator('.save-popup')).toContainText('Menu access saved.');
 if(original)await control.check();else await control.uncheck();
 await context.close();
});
