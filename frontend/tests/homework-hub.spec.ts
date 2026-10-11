import {test,expect} from '@playwright/test';

test.skip(process.env.E2E_CLASSROOM !== '1','Requires the isolated classroom server.');

test('student sees separate teacher and father homework sections',async({browser})=>{
 const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL});
 const login=await context.request.post('/api/auth/login',{data:{username:'classroom_student',password:'classroom-test'}});
 expect(login.status()).toBe(200);
 const page=await context.newPage();
 await page.route('**/api/library',async route=>{
  const response=await route.fetch();
  const data=await response.json();
  data.library.homework={
   sources:[{id:'father-source',title:'Homework List from Father',url:'https://www.notion.so/father-homework'}],
   items:[{id:'father-item',title:'Read two pages with Father',kind:'checklist',checked:false,date:'2026-10-12',sourceTitle:'Homework List from Father',notionUrl:'https://www.notion.so/father-homework',level:0}],
  };
  await route.fulfill({response,json:data});
 });
 await page.goto('/');
 const teacher=page.getByRole('link',{name:/Teacher-assigned work/});
 await expect(teacher).toBeVisible();
 await expect(teacher).toHaveAttribute('href','/coursework');
 await page.getByRole('navigation',{name:'Collections'}).getByRole('button',{name:'Homework List',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your homework. Two clear paths.'})).toBeVisible();
 await expect(teacher).toBeVisible();
 const father=page.getByRole('region',{name:'Homework List from Father'});
 await expect(father).toBeVisible();
 await expect(father.getByRole('heading',{name:/Homework List from Father/})).toBeVisible();
 await expect(father).toContainText('Read two pages with Father');
 await expect(father).toContainText('12-Oct-2026');
 await expect(father.getByRole('link',{name:/Open homework in Notion/})).toHaveAttribute('href','https://www.notion.so/father-homework');
 await page.screenshot({path:'../tmp/homework-hub-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:700});
 await page.waitForTimeout(350);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'../tmp/homework-hub-mobile.png',fullPage:true});
 await teacher.click();
 await expect(page).toHaveURL(/\/coursework$/);
 await context.close();
});
