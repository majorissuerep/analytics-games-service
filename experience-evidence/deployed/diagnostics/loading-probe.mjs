import assert from 'node:assert/strict'
import fs from 'node:fs'
import {chromium} from 'playwright'
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const context=await browser.newContext({viewport:{width:320,height:640},proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}})
const page=await context.newPage()
try{
 await page.goto('https://analytics-games-service.vercel.app',{waitUntil:'networkidle'})
 await page.locator('[data-window-id="system:welcome"]').getByRole('button',{name:'Close',exact:true}).click()
 let delayed=0
 await context.route('**/_next/static/**/*.js',async route=>{delayed++;await new Promise(r=>setTimeout(r,2500));await route.continue()})
 await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
 const host=page.locator('iframe[title="Minefield"]')
 await host.waitFor({state:'attached'})
 const loading=await host.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {busy:el.getAttribute('aria-busy'),hostHit:hit===el,hitTag:hit?.tagName,hitClass:hit?.className}})
 await page.screenshot({path:'experience-evidence/deployed/diagnostics/mine-loading-overlay.png'})
 assert.equal(loading.busy,'true');assert.equal(loading.hostHit,false)
 await page.locator('iframe[title="Minefield"][aria-busy="false"]').waitFor({timeout:60000})
 const game=page.frameLocator('iframe[title="Minefield"]')
 const control=game.getByLabel('Level',{exact:true}),box=await control.boundingBox()
 const ready=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.matches('iframe[title="Minefield"]'),{x:box.x+box.width/2,y:box.y+box.height/2})
 assert.equal(ready,true)
 await control.click()
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter')
 await game.locator('.minefield-board-scroll[data-panning="true"]').waitFor()
 assert.equal(await control.inputValue(),'intermediate')
 assert.equal(await game.locator('.minefield-cell').count(),256)
 await page.screenshot({path:'experience-evidence/deployed/diagnostics/mine-ready-real-pointer.png'})
 const record={fixture:'Real production loading-overlay observation. A delay route was installed but matched zero requests; no artificial latency is claimed. No source or stored state mutation.',delayedRequests:delayed,loading,readyControlHit:true,actualInput:'Click native Level selector then ArrowDown Enter',selected:'intermediate',cells:256}
 fs.writeFileSync('experience-evidence/deployed/diagnostics/loading-probe.json',JSON.stringify(record,null,2)+'\n')
 console.log(JSON.stringify(record))
}finally{await browser.close()}
