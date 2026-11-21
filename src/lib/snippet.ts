/**
 * Bookmarklet for story and post pages. Both pages add their media to the live page as a JSON
 * <script> after load, so it isn't in the original page source. The bookmarklet finds it,
 * keeps only the media fields, and opens Sift with them in the URL fragment (never sent to a
 * server): `#story=<base64>` on a story page, `#post=<base64>` on a post page. The JSON has
 * the shape the extractors read: {"items":[{video_versions, image_versions2}]} for a story,
 * {"items":[{"carousel_media":[...]}]} for a post.
 *
 * - Post: the object whose `code` is the code in the page URL (a carousel keeps its children).
 * - Story: the first reel's `items` under `reels_media`, only if the reel's user matches the user
 *   in the page URL. Highlight pages skip that check.
 * - Post images: the first candidate is the original size and carries no width/height, so it is
 *   labelled with the item's original_width/original_height. If candidates do carry sizes, the
 *   largest one is used.
 *
 * The page only embeds the data of the page that was loaded first. Opening a story or post by
 * clicking inside the app changes the URL but not that data, so the live page either has none or
 * has another user's. In both cases the bookmarklet fetches the current URL again (the same
 * request as pressing reload) and reads the data from that HTML, which is what view-source
 * shows. The result window is opened first, while the click still counts, and pointed at Sift
 * when the fetch finishes.
 *
 * The code must not contain a literal percent sign (the browser percent-decodes a javascript:
 * URL before running it) and must not name the platform.
 */
const CORE =
  // keep the media fields of one item, with its biggest picture
  'const one=n=>{const a=n.image_versions2?.candidates??[];' +
  'const t=a.reduce((b,x)=>(x.width*x.height||0)>(b.width*b.height||0)?x:b,a[0]);' +
  'return{video_versions:(n.video_versions??[]).map(v=>({url:v.url})),' +
  'image_versions2:{candidates:t?[{url:t.url,width:t.width||n.original_width,height:t.height||n.original_height}]:[]}}};' +
  // find the first object for which `f` returns a value, in those of the page's JSON scripts `sc` that mention `needle`
  "const find=(sc,needle,f)=>{let r;const w=o=>{if(!o||typeof o!=='object'||r)return;r=f(o);if(r)return;for(const k in o)w(o[k])};" +
  "for(const s of sc)if(s.type==='application/json'&&s.textContent.includes(needle)){try{w(JSON.parse(s.textContent))}catch{}}return r};" +
  // one try on a list of scripts: {kind,json} on success, {error} otherwise (retry:1 when fetching the page again may help)
  'const attempt=sc=>{' +
  'if(/^\\/stories\\//.test(location.pathname)){' +
  "const reel=find(sc,'reels_media',o=>Array.isArray(o.reels_media)&&o.reels_media[0]?.items?.length?o.reels_media[0]:null);" +
  "if(!reel)return{error:'Story data not found. Reload the story page and try again.',retry:1,why:'no story'};" +
  "const u=location.pathname.split('/')[2];" +
  "if(u!=='highlights'&&reel.user?.username&&reel.user.username.toLowerCase()!==u.toLowerCase())" +
  "return{error:'This page holds the story of another user. Reload the story page and try again.',retry:1,why:'story of '+reel.user.username};" +
  "return{kind:'story',json:JSON.stringify({items:reel.items.map(one)})}}" +
  'const c=location.pathname.match(/\\/(?:p|reel|reels|tv)\\/([\\w-]+)/)?.[1];' +
  "if(!c)return{error:'Open a post or story page first.'};" +
  'const m=find(sc,c,o=>o.code===c&&(Array.isArray(o.carousel_media)||o.image_versions2||o.video_versions)?o:null);' +
  "if(!m)return{error:'Post data not found. Reload the post page and try again.',retry:1,why:'no post'};" +
  'const k=m.carousel_media?.length?m.carousel_media:[m];' +
  "return{kind:'post',json:JSON.stringify({items:[{carousel_media:k.map(one)}]})}};"

/** The URL fragment key that carries the data: `#story=<base64>` or `#post=<base64>`. */
export type HandoffKind = 'story' | 'post'

/** The `javascript:` URL to bookmark. `siftUrl` is the page that receives the result. */
export function buildBookmarklet(siftUrl: string): string {
  const code =
    `(()=>{${CORE}` +
    `const to=r=>${JSON.stringify(siftUrl)}+'#'+r.kind+'='+encodeURIComponent(btoa(r.json));` +
    // what a list of scripts holds, for the failure alert: how many JSON scripts, how many mention the story data
    "const cnt=(sc,n)=>[...sc].filter(s=>s.type==='application/json'&&s.textContent.includes(n)).length;" +
    "const D=sc=>'json='+cnt(sc,'')+' stories='+cnt(sc,'reels_media');" +
    'const r=attempt(document.scripts);' +
    'if(!r.error){window.open(to(r));return}' +
    'if(!r.retry){alert(r.error);return}' +
    "const w=window.open('');const f={};" +
    'fetch(location.href,{credentials:"same-origin",headers:{Accept:"text/html"}})' +
    ".then(x=>{f.s=x.status+(x.redirected?' redirected to '+new URL(x.url).pathname:'');return x.text()}).then(t=>{" +
    "const sc=new DOMParser().parseFromString(t,'text/html').scripts;" +
    "f.t='len='+t.length+' '+D(sc);" +
    'const r2=attempt(sc);' +
    "if(r2.error){if(w)w.close();alert(r2.error+'\\n\\n[page: '+D(document.scripts)+' | fetched: '+f.s+' '+f.t+' | '+r2.why+']');return}" +
    'if(w)w.location.href=to(r2);else window.open(to(r2))' +
    "}).catch(e=>{if(w)w.close();alert(r.error+'\\n\\n[page: '+D(document.scripts)+' | fetch failed: '+e+']')})})()"
  return 'javascript:' + encodeURIComponent(code)
}
