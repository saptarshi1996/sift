/**
 * Bookmarklet for public post pages. Those pages add the post's media to the live page as a
 * JSON <script> after load, so it isn't in the original page source. The bookmarklet finds
 * that post (by the code in the page URL), keeps only the media fields, and opens Sift with
 * them in the URL fragment (never sent to a server), in the shape `extractPost` reads:
 * {"items":[{"carousel_media":[{video_versions, image_versions2}]}]}.
 *
 * The first image candidate is the original size and carries no width/height, so it is
 * labelled with the item's original_width/original_height. If candidates do carry sizes,
 * the largest one is used.
 *
 * The code must not contain a literal percent sign (the browser percent-decodes a
 * javascript: URL before running it) and must not name the platform.
 */
const CORE =
  'const c=location.pathname.match(/\\/(?:p|reel|reels|tv)\\/([\\w-]+)/)?.[1];' +
  "if(!c)return{error:'Open a post page first.'};" +
  "let m;const w=o=>{if(!o||typeof o!=='object'||m)return;" +
  'if(o.code===c&&(Array.isArray(o.carousel_media)||o.image_versions2||o.video_versions)){m=o;return}' +
  'for(const k in o)w(o[k])};' +
  "for(const s of document.scripts)if(s.type==='application/json'&&s.textContent.includes(c)){try{w(JSON.parse(s.textContent))}catch{}}" +
  "if(!m)return{error:'Post data not found. Reload the post page and try again.'};" +
  'const one=n=>{const a=n.image_versions2?.candidates??[];' +
  'const t=a.reduce((b,x)=>(x.width*x.height||0)>(b.width*b.height||0)?x:b,a[0]);' +
  'return{video_versions:(n.video_versions??[]).map(v=>({url:v.url})),' +
  'image_versions2:{candidates:t?[{url:t.url,width:t.width||n.original_width,height:t.height||n.original_height}]:[]}}};' +
  'const k=m.carousel_media?.length?m.carousel_media:[m];' +
  'return{json:JSON.stringify({items:[{carousel_media:k.map(one)}]})}'

/** Key of the URL fragment that carries the post data: `#post=<base64>`. */
export const HASH_KEY = 'post'

/** The `javascript:` URL to bookmark. `siftUrl` is the page that receives the result. */
export function buildBookmarklet(siftUrl: string): string {
  const code =
    `(()=>{const r=(()=>{${CORE}})();` +
    'if(r.error){alert(r.error);return}' +
    `window.open(${JSON.stringify(siftUrl)}+'#${HASH_KEY}='+encodeURIComponent(btoa(r.json)))})()`
  return 'javascript:' + encodeURIComponent(code)
}
