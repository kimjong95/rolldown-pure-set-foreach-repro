(()=>{"use strict";let t,e=(t,e)=>JSON.stringify(t)===JSON.stringify(e),i={boundingBox:{width:999},text:"edited"},r={boundingBox:{width:100},text:"original"};console.log(JSON.stringify({
  "set+forEach":JSON.stringify({}),
  "set+for-of":JSON.stringify(function(t,e,i){let r={};for(let n of new Set([...Object.keys(t),...Object.keys(e)]))"text"!==n&&(i(t[n],e[n])||(r[n]=e[n]));return r}(i,r,e)),
  "array+forEach":JSON.stringify((t={},[...Object.keys(i),...Object.keys(r)].forEach(n=>{"text"!==n&&(e(i[n],r[n])||(t[n]=r[n]))}),t))}))})();