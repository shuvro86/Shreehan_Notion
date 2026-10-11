import {test,expect} from '@playwright/test';
test('Homework List from Father stays connected to Notion',async({page})=>{
 test.setTimeout(120000);
 const username=process.env.E2E_USERNAME,password=process.env.E2E_PASSWORD;
 test.skip(!username||!password,'Authenticated app required');
 expect((await page.request.post('/api/auth/login',{data:{username,password}})).status()).toBe(200);
 let data:any;
 await expect.poll(async()=>{data=await (await page.request.get('/api/library')).json();return data.library.homework?.sources.length||0},{timeout:90000,intervals:[2000]}).toBeGreaterThan(0);
 expect(data.library.homework.items.length).toBeGreaterThan(0);
 await page.goto('/');await page.getByRole('navigation',{name:'Collections'}).getByRole('button',{name:'Homework List',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your homework. Two clear paths.',level:1})).toBeVisible();
 await expect(page.getByRole('heading',{name:/Homework List from Father/})).toBeVisible();
 await expect(page.getByRole('button',{name:/^todo list$/i})).toHaveCount(0);
 await expect(page.locator('.task-panel')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'New task',exact:true})).toHaveCount(0);
 await expect(page.locator('.homework-item')).toHaveCount(data.library.homework.items.length);
 await expect(page.locator('.homework-items')).toContainText(data.library.homework.items[0].title);
 await page.route('**/api/library',route=>route.fulfill({json:data}));
 const item=data.library.homework.items[0];item.title='Updated homework instruction';item.checked=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.homework-items')).toContainText(item.title);await expect(page.locator('.homework-item').filter({hasText:item.title})).toHaveClass(/completed/);
 data.library.homework.items=data.library.homework.items.filter((x:{id:string})=>x.id!==item.id);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.homework-items')).not.toContainText(item.title);
 const remaining=data.library.homework.items[0];
 if(remaining){await page.getByRole('textbox',{name:'Search homework'}).fill(remaining.title);await expect(page.locator('.homework-items')).toContainText(remaining.title);}
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
