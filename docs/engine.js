/* ================= 指標與訊號引擎（純函式） ================= */
const sma=(a,n)=>a.map((_,i)=>{if(i<n-1)return null;let s=0;for(let j=i-n+1;j<=i;j++)s+=a[j];return s/n});
const ema=(a,n)=>{const k=2/(n+1);const o=[];let p=null;a.forEach((v,i)=>{if(v==null){o.push(null);return}p=p==null?v:v*k+p*(1-k);o.push(i<n-1?null:p)});return o};
function rsi(c,n=14){const o=Array(c.length).fill(null);let g=0,l=0;for(let i=1;i<c.length;i++){const d=c[i]-c[i-1];const up=Math.max(d,0),dn=Math.max(-d,0);if(i<=n){g+=up;l+=dn;if(i===n){g/=n;l/=n;o[i]=l===0?100:100-100/(1+g/l)}}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n;o[i]=l===0?100:100-100/(1+g/l)}}return o}
function kd(h,l,c,n=9){const K=[],D=[];let k=50,d=50;for(let i=0;i<c.length;i++){if(i<n-1){K.push(null);D.push(null);continue}let hh=-Infinity,ll=Infinity;for(let j=i-n+1;j<=i;j++){hh=Math.max(hh,h[j]);ll=Math.min(ll,l[j])}const rsv=hh===ll?50:(c[i]-ll)/(hh-ll)*100;k=k*2/3+rsv/3;d=d*2/3+k/3;K.push(k);D.push(d)}return{K,D}}
function macd(c){const e12=ema(c,12),e26=ema(c,26);const dif=c.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null);const firstIdx=dif.findIndex(v=>v!=null);const sig=Array(c.length).fill(null);if(firstIdx>=0){const s=ema(dif.slice(firstIdx),9);s.forEach((v,j)=>sig[firstIdx+j]=v)}const hist=dif.map((v,i)=>v!=null&&sig[i]!=null?v-sig[i]:null);return{dif,sig,hist}}
function boll(c,n=20,k=2){const m=sma(c,n);const up=[],lo=[];c.forEach((_,i)=>{if(m[i]==null){up.push(null);lo.push(null);return}let s=0;for(let j=i-n+1;j<=i;j++)s+=(c[j]-m[i])**2;const sd=Math.sqrt(s/n);up.push(m[i]+k*sd);lo.push(m[i]-k*sd)});return{mid:m,up,lo}}
function atr(h,l,c,n=14){const tr=c.map((_,i)=>i===0?h[0]-l[0]:Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));const o=Array(c.length).fill(null);let a=null;for(let i=0;i<tr.length;i++){if(i<n-1)continue;if(a==null){let s=0;for(let j=0;j<n;j++)s+=tr[j];a=s/n}else a=(a*(n-1)+tr[i])/n;o[i]=a}return o}

function indicators(P){
  const o=P.map(p=>+p.o),h=P.map(p=>+p.h),l=P.map(p=>+p.l),c=P.map(p=>+p.c),v=P.map(p=>+p.v);
  return{d:P.map(p=>p.d),o,h,l,c,v,ma5:sma(c,5),ma20:sma(c,20),ma60:sma(c,60),vma20:sma(v,20),
    rsi:rsi(c),...kd(h,l,c),...macd(c),bb:boll(c),atr:atr(h,l,c)};
}

/* 單日技術面判定：回傳 setup 與技術分數 items */
function evalAt(I,i){
  const c=I.c[i],ma5=I.ma5[i],ma20=I.ma20[i],ma60=I.ma60[i],A=I.atr[i];
  if(ma60==null||A==null||I.hist[i]==null||I.hist[i-1]==null)return null;
  const items=[];const add=(w,t)=>items.push({w,t});
  const up=c>ma20&&ma20>ma60, dn=c<ma20&&ma20<ma60;
  const ma60Up=I.ma60[i]>I.ma60[i-5];
  add(c>ma20?10:-10,c>ma20?"收盤站上月線":"收盤在月線下");
  add(ma20>ma60?10:-10,ma20>ma60?"月線在季線上（中期多頭）":"月線在季線下（中期空頭）");
  add(ma60Up?5:-5,ma60Up?"季線上彎":"季線下彎");
  const hs=I.hist[i],hsUp=hs>I.hist[i-1];
  add(hs>0?8:-8,hs>0?"MACD 柱在零軸上":"MACD 柱在零軸下");
  add(hsUp?5:-5,hsUp?"MACD 柱轉強":"MACD 柱轉弱");
  const gold=j=>I.K[j]>I.D[j]&&I.K[j-1]<=I.D[j-1], dead=j=>I.K[j]<I.D[j]&&I.K[j-1]>=I.D[j-1];
  const kGold=gold(i)||gold(i-1), kDead=dead(i)||dead(i-1);
  if(kGold)add(I.K[i]<50?10:5,`KD 金叉（K=${I.K[i].toFixed(0)}）`);
  if(kDead)add(I.K[i]>70?-10:-5,`KD 死叉（K=${I.K[i].toFixed(0)}）`);
  if(I.K[i]>85)add(-5,"KD 高檔鈍化區");
  if(I.K[i]<15)add(5,"KD 低檔超賣區");
  const r=I.rsi[i];
  if(r>75)add(-8,`RSI ${r.toFixed(0)} 過熱`); else if(r<30)add(8,`RSI ${r.toFixed(0)} 超賣`);
  if(c>I.bb.up[i])add(-5,"突出布林上軌（乖離大）"); else if(c<I.bb.lo[i])add(5,"跌破布林下軌（乖離大）");
  let hh=-Infinity,ll=Infinity;for(let j=i-20;j<i;j++){hh=Math.max(hh,I.h[j]);ll=Math.min(ll,I.l[j])}
  const vr=I.vma20[i]?I.v[i]/I.vma20[i]:1;
  const breakout=c>hh&&vr>1.5, breakdown=c<ll&&vr>1.5;
  if(breakout)add(12,`帶量突破 20 日高（量比 ${vr.toFixed(1)}）`);
  if(breakdown)add(-12,`帶量跌破 20 日低（量比 ${vr.toFixed(1)}）`);
  if(!breakout&&!breakdown&&vr>2&&Math.abs(c-I.o[i])<A*0.3&&c>ma20)add(-6,`爆量不漲（量比 ${vr.toFixed(1)}），高檔換手警訊`);
  const pullback=up&&I.l[i]<=ma20+0.6*A&&c>=ma20&&(kGold||hsUp);
  const bounce=dn&&I.h[i]>=ma20-0.6*A&&c<=ma20&&(kDead||!hsUp);
  const overheat=r>75&&c>I.bb.up[i];
  const oversold=r<28&&c<I.bb.lo[i];
  let setup="NEUTRAL";
  if(breakout&&c>ma60)setup="LONG_BREAKOUT";
  else if(breakdown&&c<ma60)setup="SHORT_BREAKDOWN";
  else if(overheat)setup="OVERHEAT";
  else if(oversold)setup="OVERSOLD";
  else if(pullback)setup="LONG_PULLBACK";
  else if(bounce)setup="SHORT_BOUNCE";
  else if(up)setup="WAIT_UP";
  else if(dn)setup="WAIT_DOWN";
  return{setup,items,hh,ll,vr};
}

/* 基本面與籌碼加分（只用於最新一日） */
function fundItems(S){
  const items=[];const add=(w,t)=>items.push({w,t});
  const R=S.revenue||[];
  if(R.length){const r=R[R.length-1];if(r.yoy!=null){
    if(r.yoy>=30)add(10,`${r.ym} 營收年增 ${r.yoy.toFixed(1)}%`);
    else if(r.yoy>=10)add(5,`${r.ym} 營收年增 ${r.yoy.toFixed(1)}%`);
    else if(r.yoy<0)add(-8,`${r.ym} 營收年減 ${Math.abs(r.yoy).toFixed(1)}%`);
    else add(0,`${r.ym} 營收年增 ${r.yoy.toFixed(1)}%`);}}
  const PE=S.per||[];
  if(PE.length){const p=PE[PE.length-1];
    if(!p.per||p.per<=0)add(-6,"近四季虧損或無本益比");
    else if(p.per>150)add(-8,`本益比 ${p.per.toFixed(0)} 倍，評價過高`);
    else if(p.per>60)add(-3,`本益比 ${p.per.toFixed(0)} 倍，評價偏高`);
    else if(p.per<25)add(4,`本益比 ${p.per.toFixed(0)} 倍，評價合理`);}
  const N=S.inst||[];
  if(N.length>=5){const s5=N.slice(-5).reduce((a,x)=>a+(x.foreign||0)+(x.trust||0),0);
    if(s5>0)add(6,`外資＋投信 5 日買超 ${Math.round(s5).toLocaleString()} 張`);
    else if(s5<0)add(-6,`外資＋投信 5 日賣超 ${Math.round(-s5).toLocaleString()} 張`);}
  const M=S.margin||[];
  if(M.length>=6){const a=M[M.length-6],b=M[M.length-1];
    const dm=b.margin-a.margin;
    if(b.margin>0&&dm/b.margin>0.08)add(-4,`融資 5 日增 ${Math.round(dm).toLocaleString()} 張（散戶追價）`);
    if(b.short>0&&b.margin>0&&b.short/b.margin>0.3)add(3,`券資比 ${(b.short/b.margin*100).toFixed(0)}%（軋空燃料）`);}
  return items;
}

const SETUP={
  LONG_BREAKOUT:{call:"做多：突破",cls:"L",dir:1},
  LONG_PULLBACK:{call:"做多：拉回買",cls:"L",dir:1},
  SHORT_BREAKDOWN:{call:"放空：跌破",cls:"S",dir:-1},
  SHORT_BOUNCE:{call:"放空：反彈空",cls:"S",dir:-1},
  OVERHEAT:{call:"過熱：不追多",cls:"H",dir:0},
  OVERSOLD:{call:"超賣：不追空",cls:"H",dir:0},
  WAIT_UP:{call:"多頭觀望",cls:"W",dir:0},
  WAIT_DOWN:{call:"空頭觀望",cls:"W",dir:0},
  NEUTRAL:{call:"盤整觀望",cls:"W",dir:0}
};

function makePlan(I,i,E){
  const c=I.c[i],A=I.atr[i],m20=I.ma20[i],m5=I.ma5[i],m60=I.ma60[i];
  const r=x=>Math.round(x*100)/100;
  let rows=[],trig="",lines=[];
  const longPlan=(entry,why)=>{const stop=Math.min(entry-2*A,m20-A);const t1=entry+2*A,t2=entry+4*A;
    rows=[["方向","做多"],["進場",r(entry)],["停損",r(stop)],["目標一",r(t1)],["目標二",r(t2)],["風險報酬",((t1-entry)/(entry-stop)).toFixed(2)+" : 1"]];
    lines=[[entry,"進場","navy"],[stop,"停損","down"],[t1,"T1","up"],[t2,"T2","up"]];trig=why};
  const shortPlan=(entry,why)=>{const stop=Math.max(entry+2*A,m20+A);const t1=entry-2*A,t2=entry-4*A;
    rows=[["方向","放空"],["進場",r(entry)],["停損",r(stop)],["目標一",r(t1)],["目標二",r(t2)],["風險報酬",((entry-t1)/(stop-entry)).toFixed(2)+" : 1"]];
    lines=[[entry,"進場","navy"],[stop,"停損","up"],[t1,"T1","down"],[t2,"T2","down"]];trig=why};
  switch(E.setup){
    case"LONG_BREAKOUT":longPlan(c,`已帶量突破 ${r(E.hh)}。可於次日開盤不跳空過大時進場；若回落收在 ${r(E.hh)} 之下視為假突破出場。`);break;
    case"LONG_PULLBACK":longPlan(Math.max(c,m20),`多頭回測月線 ${r(m20)} 有撐。進場區 ${r(m20)}–${r(m20+0.5*A)}；收盤跌破季線 ${r(m60)} 則多頭結構失效。`);break;
    case"SHORT_BREAKDOWN":shortPlan(c,`已帶量跌破 ${r(E.ll)}。反彈不過 ${r(E.ll)} 可續空；站回 ${r(E.ll)} 之上視為假跌破回補。`);break;
    case"SHORT_BOUNCE":shortPlan(Math.min(c,m20),`空頭反彈至月線 ${r(m20)} 受壓。空單區 ${r(m20-0.5*A)}–${r(m20)}；收盤站上季線 ${r(m60)} 則空頭結構失效。`);break;
    case"OVERHEAT":rows=[["方向","等待試空"],["觸發價",r(m5)],["參考停損",r(Math.max(...I.h.slice(i-4,i+1))*1.01)],["回檔目標",r(m20)]];
      lines=[[m5,"MA5 觸發","navy"],[m20,"月線目標","down"]];
      trig=`乖離過大不追多。收盤跌破 MA5 ${r(m5)} 且 KD 死叉時可小量試空，停損設近 5 日高點上方 1%，目標回測月線 ${r(m20)}。`;break;
    case"OVERSOLD":rows=[["方向","等待搶反彈"],["觸發價",r(m5)],["參考停損",r(Math.min(...I.l.slice(i-4,i+1))*0.99)],["反彈目標",r(m20)]];
      lines=[[m5,"MA5 觸發","navy"],[m20,"月線目標","up"]];
      trig=`跌深不追空。收盤站回 MA5 ${r(m5)} 且 KD 金叉時可小量搶反彈，目標月線 ${r(m20)}。`;break;
    case"WAIT_UP":rows=[["方向","多方等拉回"],["買進區下緣",r(m20)],["買進區上緣",r(m20+0.5*A)],["突破追價點",r(E.hh)],["多空分界（季線）",r(m60)]];
      lines=[[m20,"買區","navy"],[E.hh,"20日高","up"],[m60,"季線","down"]];
      trig=`多頭排列但無進場訊號。兩種進場：拉回 ${r(m20)}–${r(m20+0.5*A)} 且 KD 金叉；或帶量（>1.5 倍均量）收盤突破 ${r(E.hh)}。`;break;
    case"WAIT_DOWN":rows=[["方向","空方等反彈"],["空單區下緣",r(m20-0.5*A)],["空單區上緣",r(m20)],["跌破追空點",r(E.ll)],["多空分界（季線）",r(m60)]];
      lines=[[m20,"空區","navy"],[E.ll,"20日低","down"],[m60,"季線","up"]];
      trig=`空頭排列但無進場訊號。兩種空點：反彈至 ${r(m20-0.5*A)}–${r(m20)} 且 KD 死叉；或帶量收盤跌破 ${r(E.ll)}。`;break;
    default:rows=[["方向","觀望"],["上方壓力（20日高）",r(E.hh)],["下方支撐（20日低）",r(E.ll)],["月線",r(m20)],["季線",r(m60)]];
      lines=[[E.hh,"壓力","up"],[E.ll,"支撐","down"]];
      trig=`均線糾結、方向未明。帶量突破 ${r(E.hh)} 轉做多；帶量跌破 ${r(E.ll)} 轉放空。`;
  }
  return{rows,trig,lines};
}

function backtest(I){
  const out={L:[],S:[]};
  for(let i=61;i<I.c.length-10;i++){const E=evalAt(I,i);if(!E)continue;const d=SETUP[E.setup].dir;
    if(d===0)continue;const ret=(I.c[i+10]/I.c[i]-1)*d;(d>0?out.L:out.S).push(ret);}
  const st=a=>a.length?{n:a.length,win:a.filter(x=>x>0).length/a.length,avg:a.reduce((s,x)=>s+x,0)/a.length}:null;
  return{L:st(out.L),S:st(out.S)};
}

function analyze(S){
  if(!S||!S.prices||S.prices.length<70)return null;
  const I=indicators(S.prices);const i=I.c.length-1;
  const E=evalAt(I,i);if(!E)return null;
  const items=[...E.items,...fundItems(S)];
  const raw=items.reduce((s,x)=>s+x.w,0);
  const score=Math.max(-100,Math.min(100,Math.round(raw*100/75)));
  return{I,i,E,items,score,plan:makePlan(I,i,E),bt:backtest(I)};
}
if(typeof module!=="undefined")module.exports={indicators,evalAt,analyze,backtest,SETUP};
