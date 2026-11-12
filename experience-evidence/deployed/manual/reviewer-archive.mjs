import { assertDeployedIdentity } from './deployed-identity.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const directory=dirname(fileURLToPath(import.meta.url)), base='https://analytics-games-service.vercel.app'
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const context=await browser.newContext({proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY},viewport:{width:1180,height:796}})
await context.addInitScript(()=>localStorage.setItem('analytics-games.analytics-consent.v1','denied'))
const page=await context.newPage(), observations=[]
async function capture(state,window='fixture-long-archive'){
 const name=`chess-sections-${state}`,path=join(directory,`${name}.png`)
 await page.screenshot({path,animations:'disabled'})
 const identity=await(await page.request.get(`${base}/api/build-identity`)).json()
 assertDeployedIdentity(identity)
 writeFileSync(join(directory,`${name}.json`),JSON.stringify({scenarioId:'chess-sections',state,window,viewport:page.viewportSize(),capturedAt:new Date().toISOString(),url:page.url(),identity,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')},null,2)+'\n')
}
try{
 const response=await(await page.request.get(`${base}/api/chess-model-matches`)).json();assert.ok(response.matches.length)
 const seed=response.matches[0]
 const matches=Array.from({length:24},(_,index)=>({...seed,id:`review-fixture-${index+1}`,white_model_name:`Archive fixture ${String(index+1).padStart(2,'0')}`}))
 await context.route('**/api/chess-model-matches',route=>route.request().method()==='GET'?route.fulfill({json:{matches}}):route.abort())
 await page.goto(base)
 await page.locator('[data-window-id="system:welcome"]').getByRole('button',{name:'Close',exact:true}).click()
 await page.locator('.desktop-icon[aria-label="Open Chess"]').dblclick()
 const game=page.frameLocator('iframe[title="Chess"]')
 await game.getByRole('button',{name:/^Model arena/}).click()
 await game.getByRole('button',{name:'Saved matches',exact:true}).click()
 await game.getByText(/Archive fixture 24/).waitFor()
 const archive=game.locator('.chess-match-archive'), nav=game.getByRole('navigation',{name:'Game mode'})
 const top=await archive.evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scrollHeight:el.scrollHeight}))
 assert.ok(top.scrollHeight>top.height+200)
 const navBefore=await nav.boundingBox()
 await capture('fixture-archive24-top')
 const box=await archive.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,4000);await page.waitForTimeout(250)
 const bottom=await archive.evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scrollHeight:el.scrollHeight}))
 assert.ok(bottom.top>200)
 assert.deepEqual(await nav.boundingBox(),navBefore)
 for(const button of await nav.getByRole('button').all()) assert.ok(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}))
 assert.deepEqual(await game.locator('html').evaluate(el=>[el.scrollLeft,el.scrollTop,el.scrollWidth-innerWidth,el.scrollHeight-innerHeight]),[0,0,0,0])
 await capture('fixture-archive24-wheel-bottom')
 observations.push({fixture:'Browser GET response only;24 repeated legitimate match-shaped rows labelled Archive fixture. No stored matches created.',input:'Actual mouse wheel4000 over archive',top,bottom,anchoredNav:true,documentOverflow:false})
 await page.setViewportSize({width:390,height:844})
 await game.getByRole('button',{name:'Saved matches',exact:true}).waitFor()
 for(const button of await nav.getByRole('button').all()) assert.ok(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}))
 await capture('fixture-archive24-narrow','fixture-long-archive-clamped')
 writeFileSync(join(directory,'archive-observations.json'),JSON.stringify(observations,null,2)+'\n')
 console.log(JSON.stringify(observations))
}finally{await browser.close()}
