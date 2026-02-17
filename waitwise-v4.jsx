import { useState, useEffect, useRef, useCallback } from "react";

// ─── STATIC DATA ──────────────────────────────────────────────────────────────
const INIT_CENTERS = [
  { id:1, name:"QuickFix Auto Care",    type:"Vehicle Repair",     icon:"🔧", address:"12, Jalan Teknologi 3, PJ",       distance:0.8, queue:4,  avgServiceTime:15, slots:12, slotsBooked:8,  status:"open", rating:4.7, crowd:"medium", lat:3.121, lng:101.657 },
  { id:2, name:"MediCare Clinic",        type:"Healthcare",         icon:"🏥", address:"88, Persiaran Bestari, Shah Alam",distance:1.4, queue:11, avgServiceTime:20, slots:20, slotsBooked:18, status:"open", rating:4.5, crowd:"high",   lat:3.085, lng:101.532 },
  { id:3, name:"CitizenHub JPJ",         type:"Government Service", icon:"🏛️", address:"Level 2, Wisma Persekutuan, KL",  distance:2.1, queue:2,  avgServiceTime:25, slots:30, slotsBooked:9,  status:"open", rating:3.9, crowd:"low",    lat:3.149, lng:101.702 },
  { id:4, name:"GlowUp Salon & Spa",     type:"Personal Care",      icon:"💇", address:"Lot G-12, Mid Valley, KL",        distance:3.5, queue:7,  avgServiceTime:45, slots:15, slotsBooked:12, status:"open", rating:4.8, crowd:"high",   lat:3.117, lng:101.676 },
  { id:5, name:"TechRescue Electronics", type:"Electronics Repair", icon:"📱", address:"Unit 3-5, Suria KLCC",            distance:4.2, queue:1,  avgServiceTime:30, slots:10, slotsBooked:3,  status:"open", rating:4.3, crowd:"low",    lat:3.158, lng:101.712 },
];
const SERVICE_TYPES = ["All","Vehicle Repair","Healthcare","Government Service","Personal Care","Electronics Repair"];
const CROWD = { low:{label:"Low",color:"#4ade80",bars:1}, medium:{label:"Moderate",color:"#fbbf24",bars:2}, high:{label:"Busy",color:"#f87171",bars:3} };
const DEMO_USERS  = [{ email:"user@demo.com",  password:"demo123",  name:"Alex Tan",    phone:"012-3456789", role:"user"  }];
const DEMO_ADMINS = [{ email:"admin@demo.com", password:"admin123", name:"Admin Razif", phone:"011-9876543", role:"admin", centerId:1, center:"QuickFix Auto Care" }];
const SAMPLE_REVIEWS = {
  1:[{user:"Farah L.", rating:5,comment:"Super fast, barely waited!",date:"2d ago"},{user:"Kumar R.",rating:4,comment:"Well organised queue system.",date:"5d ago"}],
  2:[{user:"Mei Ling", rating:3,comment:"Long wait but doctors are thorough.",date:"1d ago"},{user:"Johan S.",rating:5,comment:"Loved the virtual queue!",date:"3d ago"}],
  3:[{user:"Azlan M.", rating:4,comment:"Surprisingly smooth for gov service.",date:"1w ago"}],
  4:[{user:"Priya N.", rating:5,comment:"Best salon, worth the wait!",date:"4d ago"}],
  5:[{user:"Wei Hao",  rating:4,comment:"Quick fix for my phone screen!",date:"2d ago"}],
};

// Slot status definitions
const SLOT_STATUS = {
  confirmed:  { label:"Confirmed",  color:"#4ade80", bg:"#052e16", icon:"✅" },
  cancelled:  { label:"Cancelled",  color:"#f87171", bg:"#2e0a0a", icon:"❌" },
  completed:  { label:"Completed",  color:"#a78bfa", bg:"#1e1b4b", icon:"🏁" },
  pending:    { label:"Pending",    color:"#fbbf24", bg:"#1c1500", icon:"⏳" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const calcWait  = (q,avg) => q*avg;
const fmtWait   = m => m===0?"No Wait":m<60?`~${m}m`:`~${Math.floor(m/60)}h ${m%60}m`;
const waitColor = m => m<30?"#4ade80":m<90?"#fbbf24":"#f87171";
const tsNow     = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const uid       = () => Math.random().toString(36).slice(2,9);

const DEFAULT_PREFS = {
  slotConfirmed:   { enabled:true,  label:"Slot Confirmed",               icon:"✅", desc:"When your booking is successful" },
  queueAlmostDone: { enabled:true,  label:"Queue Almost Done (You're next!)", icon:"🔔", desc:"When you're near the front of the queue" },
  centerStatus:    { enabled:true,  label:"Center Open / Closed",         icon:"🏢", desc:"When a center changes its operating status" },
  waitThreshold:   { enabled:true,  label:"Wait Time Threshold Alert",    icon:"⚡", desc:"Alert when wait drops below your set threshold" },
};
const DEFAULT_THRESHOLD = 15;

// ─── UI ATOMS ────────────────────────────────────────────────────────────────
function CrowdBars({level}){
  const m=CROWD[level];
  return <span style={{display:"flex",gap:3,alignItems:"flex-end"}}>
    {[1,2,3].map(b=><span key={b} style={{width:5,height:6+b*4,borderRadius:2,background:b<=m.bars?m.color:"#222235",transition:"background .4s"}}/>)}
  </span>;
}
function WaitRing({wait,maxWait}){
  const pct=Math.min(wait/Math.max(maxWait,1),1),r=26,circ=2*Math.PI*r,col=waitColor(wait);
  return <svg width={66} height={66} viewBox="0 0 66 66">
    <circle cx={33} cy={33} r={r} fill="none" stroke="#161626" strokeWidth={6}/>
    <circle cx={33} cy={33} r={r} fill="none" stroke={col} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" transform="rotate(-90 33 33)" style={{transition:"stroke-dashoffset .7s ease,stroke .5s"}}/>
    <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill={col} fontSize={9} fontWeight="700" fontFamily="'JetBrains Mono',monospace">{wait===0?"FREE":`${wait}m`}</text>
  </svg>;
}
function StarRow({rating}){
  return <span style={{display:"flex",gap:1}}>{[1,2,3,4,5].map(i=><span key={i} style={{fontSize:11,color:i<=Math.round(rating)?"#fbbf24":"#2a2a3e"}}>★</span>)}</span>;
}
function SlotBadge({status}){
  const s=SLOT_STATUS[status]||SLOT_STATUS.pending;
  return <span style={{background:s.bg,color:s.color,border:`1px solid ${s.color}33`,borderRadius:7,padding:"3px 10px",fontSize:10,fontWeight:700,fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap"}}>{s.icon} {s.label}</span>;
}

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
function NotifBell({inbox,onToggle}){
  const unread=inbox.filter(n=>!n.read).length;
  return (
    <button onClick={onToggle} style={{position:"relative",background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:10,width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
      🔔
      {unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:"linear-gradient(135deg,#ef4444,#f87171)",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",fontFamily:"'Syne',sans-serif",border:"2px solid #080814",animation:"pulse 2s infinite"}}>{unread>9?"9+":unread}</span>}
    </button>
  );
}
function NotifInbox({inbox,onClose,onMarkRead,onMarkAllRead,onClear}){
  return (
    <div style={{position:"fixed",top:70,right:20,zIndex:800,width:360,maxHeight:520,background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:20,boxShadow:"0 24px 80px rgba(0,0,0,.7)",display:"flex",flexDirection:"column",animation:"slideDown .25s ease",overflow:"hidden"}}>
      <div style={{padding:"16px 18px 12px",borderBottom:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:15}}>🔔 Notifications</p>
          <p style={{fontSize:9,color:"#4b5563",marginTop:1}}>{inbox.filter(n=>!n.read).length} unread · {inbox.length} total</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={onMarkAllRead} style={{fontSize:9,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600}}>Mark all read</button>
          <button onClick={onClear} style={{fontSize:9,color:"#4b5563",background:"none",border:"none",cursor:"pointer"}}>Clear</button>
          <button onClick={onClose} style={{background:"#161626",border:"none",color:"#6b7280",borderRadius:7,width:26,height:26,cursor:"pointer",fontSize:13}}>✕</button>
        </div>
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {inbox.length===0?(
          <div style={{padding:40,textAlign:"center"}}><p style={{fontSize:36,marginBottom:10}}>🔕</p><p style={{fontFamily:"'Syne',sans-serif",color:"#4b5563",fontSize:13}}>No notifications yet</p></div>
        ):inbox.map(n=>(
          <div key={n.id} onClick={()=>onMarkRead(n.id)} style={{padding:"12px 18px",borderBottom:"1px solid #1a1a2e",display:"flex",gap:12,alignItems:"flex-start",background:n.read?"transparent":"rgba(99,102,241,0.04)",cursor:"pointer"}}>
            <div style={{width:36,height:36,borderRadius:10,background:n.read?"#161626":"#1e1b4b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:`1px solid ${n.read?"#1e1e30":"#3730a3"}`}}>{n.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:n.read?"#6b7280":"#e5e7eb",fontSize:12}}>{n.title}</p>
                {!n.read&&<span style={{width:7,height:7,borderRadius:"50%",background:"#6366f1",flexShrink:0,marginTop:3}}/>}
              </div>
              <p style={{fontSize:11,color:"#4b5563",lineHeight:1.4}}>{n.msg}</p>
              <p style={{fontSize:9,color:"#374151",marginTop:3}}>{n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NOTIFICATION SETTINGS ────────────────────────────────────────────────────
function NotifSettings({prefs,threshold,onPrefsChange,onThresholdChange,onClose}){
  const [localT,setLocalT]=useState(threshold);
  return (
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .2s"}}>
      <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:24,padding:32,width:460,maxWidth:"95vw",boxShadow:"0 32px 80px rgba(0,0,0,.7)",animation:"slideUp .25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div><p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>Notification Preferences</p><h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:20}}>🔔 Alert Settings</h2></div>
          <button onClick={onClose} style={{background:"#161626",border:"none",color:"#6b7280",borderRadius:9,width:34,height:34,cursor:"pointer",fontSize:16}}>✕</button>
        </div>
        <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Notification Types</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
          {Object.entries(prefs).map(([key,pref])=>(
            <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#161626",borderRadius:14,padding:"14px 16px",border:`1px solid ${pref.enabled?"#2a2a4e":"#1a1a2e"}`}}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <span style={{width:38,height:38,borderRadius:10,background:pref.enabled?"#1e1b4b":"#111120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:`1px solid ${pref.enabled?"#3730a3":"#1e1e30"}`}}>{pref.icon}</span>
                <div><p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:pref.enabled?"#e5e7eb":"#4b5563",fontSize:13}}>{pref.label}</p><p style={{fontSize:10,color:"#374151",marginTop:1}}>{pref.desc}</p></div>
              </div>
              <button onClick={()=>onPrefsChange(key,!pref.enabled)} style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",background:pref.enabled?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#1e1e2e",position:"relative",transition:"background .3s",flexShrink:0}}>
                <span style={{position:"absolute",top:3,left:pref.enabled?24:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .25s ease",boxShadow:"0 2px 6px rgba(0,0,0,.4)"}}/>
              </button>
            </div>
          ))}
        </div>
        <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Wait-Time Threshold</p>
        <div style={{background:"#161626",borderRadius:14,padding:18,border:`1px solid ${prefs.waitThreshold?.enabled?"#2a2a4e":"#1a1a2e"}`}}>
          <p style={{fontSize:11,color:prefs.waitThreshold?.enabled?"#9ca3af":"#374151",marginBottom:12,lineHeight:1.5}}>{prefs.waitThreshold?.enabled?"Alert when any queue wait drops below your threshold.":"Enable the threshold toggle above to use this."}</p>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{flex:1}}>
              <input type="range" min={5} max={60} step={5} value={localT} onChange={e=>setLocalT(Number(e.target.value))} disabled={!prefs.waitThreshold?.enabled} style={{width:"100%",accentColor:"#6366f1",cursor:prefs.waitThreshold?.enabled?"pointer":"not-allowed",opacity:prefs.waitThreshold?.enabled?1:.4}}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:9,color:"#374151"}}>5m</span><span style={{fontSize:9,color:"#374151"}}>60m</span></div>
            </div>
            <div style={{background:"#0d0d1c",borderRadius:10,padding:"8px 14px",minWidth:70,textAlign:"center",border:"1px solid #1e1e30"}}>
              <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:prefs.waitThreshold?.enabled?"#fbbf24":"#374151"}}>{localT}m</p>
              <p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1}}>threshold</p>
            </div>
          </div>
        </div>
        <button onClick={()=>{onThresholdChange(localT);onClose();}} style={{width:"100%",marginTop:20,padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",boxShadow:"0 8px 24px rgba(99,102,241,.3)"}}>Save Preferences ✓</button>
      </div>
    </div>
  );
}

// ─── BOOKING MODAL ────────────────────────────────────────────────────────────
function BookingModal({center,user,onClose,onBook,redoData}){
  const [slot,setSlot]=useState(redoData?.slot||"");
  const [done,setDone]=useState(false);
  const slots=[];const base=new Date();
  for(let i=1;i<=6;i++){const t=new Date(base.getTime()+i*30*60000);slots.push(t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));}
  function confirm(){if(!slot)return;setDone(true);setTimeout(()=>{onBook(center.id,slot);onClose();},1800);}
  return (
    <div style={{position:"fixed",inset:0,zIndex:850,background:"rgba(0,0,0,.78)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .2s"}}>
      <div style={{background:"#13131f",border:"1px solid #2a2a3a",borderRadius:22,padding:32,width:420,maxWidth:"95vw",boxShadow:"0 32px 80px rgba(0,0,0,.6)",animation:"slideUp .25s ease"}}>
        {!done?<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <p style={{fontSize:9,color:"#6b7280",textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>{redoData?"Re-booking Slot":"Virtual Slot Booking"}</p>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#fff"}}>{center.icon} {center.name}</h2>
              {user&&<p style={{fontSize:10,color:"#6b7280",marginTop:2}}>Booking as {user.name}</p>}
            </div>
            <button onClick={onClose} style={{background:"#1e1e2e",border:"none",color:"#9ca3af",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          {redoData&&<div style={{background:"#1c1500",border:"1px solid #fbbf2444",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",gap:8,alignItems:"center"}}>
            <span>🔄</span><p style={{fontSize:11,color:"#fbbf24"}}>Re-booking previously cancelled slot. Previous time: <b>{redoData.slot}</b></p>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
            <div style={{background:"#0d0d1a",borderRadius:10,padding:"10px 14px"}}><p style={{fontSize:8,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Queue Now</p><p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:"#fbbf24"}}>{center.queue}</p></div>
            <div style={{background:"#0d0d1a",borderRadius:10,padding:"10px 14px"}}><p style={{fontSize:8,color:"#6b7280",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Est. Wait</p><p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:"#4ade80"}}>{calcWait(center.queue,center.avgServiceTime)}m</p></div>
          </div>
          <p style={{fontSize:9,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Choose Time Slot</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
            {slots.map(s=><button key={s} onClick={()=>setSlot(s)} style={{padding:"9px 4px",borderRadius:9,border:`1.5px solid ${slot===s?"#6366f1":"#2a2a3a"}`,background:slot===s?"#1e1b4b":"#0d0d1a",color:slot===s?"#a5b4fc":"#6b7280",fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer",transition:"all .2s"}}>{s}</button>)}
          </div>
          <button onClick={confirm} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:slot?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#1e1e2e",color:slot?"#fff":"#4b5563",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,cursor:slot?"pointer":"not-allowed",transition:"all .3s",boxShadow:slot?"0 8px 24px rgba(99,102,241,.35)":"none"}}>
            {redoData?"Re-confirm Slot →":"Confirm Slot →"}
          </button>
        </>:(
          <div style={{textAlign:"center",padding:"28px 0"}}>
            <div style={{fontSize:56,marginBottom:14,animation:"pop .4s ease"}}>✅</div>
            <h2 style={{fontFamily:"'Syne',sans-serif",color:"#fff",fontSize:20,marginBottom:8}}>Slot {redoData?"Re-booked":"Confirmed"}!</h2>
            <p style={{color:"#6b7280",fontSize:13}}>Booked at <b style={{color:"#a5b4fc"}}>{center.name}</b> for {slot}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── REVIEW MODAL ─────────────────────────────────────────────────────────────
function ReviewModal({center,user,onClose,onSubmit}){
  const [stars,setStars]=useState(0),[comment,setComment]=useState(""),[done,setDone]=useState(false);
  function submit(){if(!stars)return;setDone(true);setTimeout(()=>{onSubmit(center.id,{user:user?.name||"Anonymous",rating:stars,comment,date:"Just now"});onClose();},1400);}
  return (
    <div style={{position:"fixed",inset:0,zIndex:850,background:"rgba(0,0,0,.78)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#13131f",border:"1px solid #2a2a3a",borderRadius:22,padding:30,width:380,maxWidth:"95vw",animation:"slideUp .25s ease"}}>
        {!done?<>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:16}}>Rate {center.name}</h2>
            <button onClick={onClose} style={{background:"#1e1e2e",border:"none",color:"#9ca3af",borderRadius:8,width:30,height:30,cursor:"pointer"}}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:18}}>
            {[1,2,3,4,5].map(i=><button key={i} onClick={()=>setStars(i)} style={{fontSize:28,background:"none",border:"none",cursor:"pointer",color:i<=stars?"#fbbf24":"#2a2a3e",transition:"all .2s",transform:i<=stars?"scale(1.15)":"scale(1)"}}>★</button>)}
          </div>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Share your experience... (optional)" rows={3} style={{width:"100%",background:"#0d0d1a",border:"1.5px solid #2a2a3a",borderRadius:10,padding:"10px 14px",color:"#fff",fontSize:12,fontFamily:"'JetBrains Mono',monospace",resize:"none",marginBottom:16,outline:"none",boxSizing:"border-box"}}/>
          <button onClick={submit} style={{width:"100%",padding:13,borderRadius:12,border:"none",background:stars?"linear-gradient(135deg,#f59e0b,#ef4444)":"#1e1e2e",color:stars?"#fff":"#4b5563",fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:stars?"pointer":"not-allowed"}}>Submit Review ★</button>
        </>:(
          <div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:48,marginBottom:12}}>🌟</div><p style={{fontFamily:"'Syne',sans-serif",color:"#fff",fontSize:16,fontWeight:700}}>Thank you!</p></div>
        )}
      </div>
    </div>
  );
}

// ─── SLOT STATUS PANEL ────────────────────────────────────────────────────────
function SlotStatusPanel({bookings,centers,onCancel,onRedo,onClose}){
  const active=bookings.filter(b=>b.slotStatus==="confirmed"||b.slotStatus==="pending");
  const past=bookings.filter(b=>b.slotStatus==="cancelled"||b.slotStatus==="completed");
  return (
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,.78)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .2s"}}>
      <div style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:24,padding:0,width:540,maxWidth:"95vw",maxHeight:"85vh",boxShadow:"0 32px 80px rgba(0,0,0,.7)",animation:"slideUp .25s ease",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"22px 26px 16px",borderBottom:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>Slot Management</p>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:20}}>🎫 My Slot Status</h2>
          </div>
          <button onClick={onClose} style={{background:"#161626",border:"none",color:"#6b7280",borderRadius:9,width:34,height:34,cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        {/* Legend */}
        <div style={{padding:"12px 26px",borderBottom:"1px solid #1a1a2e",display:"flex",gap:12,flexWrap:"wrap"}}>
          {Object.entries(SLOT_STATUS).map(([k,v])=>(
            <span key={k} style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{background:v.bg,color:v.color,borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:700,border:`1px solid ${v.color}33`}}>{v.icon} {v.label}</span>
            </span>
          ))}
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 26px 24px"}}>
          {/* Active slots */}
          <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Active Bookings ({active.length})</p>
          {active.length===0?(
            <div style={{background:"#161626",borderRadius:14,padding:20,textAlign:"center",marginBottom:20,border:"1px dashed #1a1a2e"}}>
              <p style={{color:"#4b5563",fontSize:13,fontFamily:"'Syne',sans-serif"}}>No active bookings. Book a slot to get started.</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {active.map((b,i)=>{
                const c=centers.find(x=>x.id===b.centerId)||{};
                return (
                  <div key={b.id||i} style={{background:"#161626",borderRadius:16,padding:"14px 16px",border:"1px solid #1e1e30",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center"}}>
                    <div style={{width:44,height:44,borderRadius:12,background:"#0d0d1c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"1px solid #1a1a2e"}}>{b.centerIcon}</div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:13}}>{b.centerName}</p>
                        <SlotBadge status={b.slotStatus}/>
                      </div>
                      <p style={{fontSize:10,color:"#6b7280"}}>Slot: <b style={{color:"#a5b4fc"}}>{b.slot}</b> · Booked at {b.bookedAt}</p>
                      <p style={{fontSize:9,color:"#4b5563",marginTop:2}}>Est. wait at booking: ~{b.waitAtBook}m</p>
                    </div>
                    <button onClick={()=>onCancel(b.id||i)} style={{padding:"8px 14px",borderRadius:9,border:"1px solid #2e1a1a",background:"#1a0808",color:"#f87171",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>Cancel ✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past slots */}
          <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Past & Cancelled ({past.length})</p>
          {past.length===0?(
            <div style={{background:"#161626",borderRadius:14,padding:20,textAlign:"center",border:"1px dashed #1a1a2e"}}>
              <p style={{color:"#4b5563",fontSize:13,fontFamily:"'Syne',sans-serif"}}>No past bookings.</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {past.map((b,i)=>{
                const c=centers.find(x=>x.id===b.centerId)||{};
                return (
                  <div key={b.id||i} style={{background:"#111120",borderRadius:16,padding:"14px 16px",border:"1px solid #1a1a2e",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center",opacity:0.85}}>
                    <div style={{width:44,height:44,borderRadius:12,background:"#0d0d1c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"1px solid #1a1a2e",filter:"grayscale(0.4)"}}>{b.centerIcon}</div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#6b7280",fontSize:13}}>{b.centerName}</p>
                        <SlotBadge status={b.slotStatus}/>
                      </div>
                      <p style={{fontSize:10,color:"#4b5563"}}>Slot: <b style={{color:"#6b7280"}}>{b.slot}</b> · {b.bookedAt}</p>
                    </div>
                    {b.slotStatus==="cancelled"&&(
                      <button onClick={()=>onRedo(b)} style={{padding:"8px 14px",borderRadius:9,border:"1px solid #1a2e1a",background:"#0a1a0a",color:"#4ade80",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>Redo 🔄</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAP VIEW ─────────────────────────────────────────────────────────────────
function MapView({centers,onBook}){
  const [hovered,setHovered]=useState(null);
  const bounds={minLat:3.07,maxLat:3.17,minLng:101.51,maxLng:101.73};
  const toX=lng=>((lng-bounds.minLng)/(bounds.maxLng-bounds.minLng))*520+40;
  const toY=lat=>(1-(lat-bounds.minLat)/(bounds.maxLat-bounds.minLat))*300+40;
  return (
    <div style={{background:"#0d0d1c",borderRadius:20,border:"1px solid #1e1e30",overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid #1e1e30",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:14}}>📍 Live Map — KL / PJ Area</p><p style={{fontSize:10,color:"#6b7280",marginTop:2}}>Hover for details · Click to book</p></div>
        <span style={{fontSize:10,color:"#4ade80",background:"#052e16",borderRadius:8,padding:"4px 10px",border:"1px solid #4ade8033"}}>LIVE</span>
      </div>
      <div style={{position:"relative",height:380,background:"linear-gradient(160deg,#0d0d1c,#111128)",overflow:"hidden"}}>
        <svg style={{position:"absolute",inset:0}} width="100%" height="100%">
          {[...Array(8)].map((_,i)=><line key={`h${i}`} x1="0" y1={`${i*12.5}%`} x2="100%" y2={`${i*12.5}%`} stroke="#ffffff05" strokeWidth="1"/>)}
          {[...Array(10)].map((_,i)=><line key={`v${i}`} x1={`${i*10}%`} y1="0" x2={`${i*10}%`} y2="100%" stroke="#ffffff05" strokeWidth="1"/>)}
          <path d="M40 200 Q200 180 350 200 Q450 215 560 190" stroke="#1e2a4a" strokeWidth="8" fill="none"/>
          <path d="M150 40 Q160 180 155 380" stroke="#1e2a4a" strokeWidth="6" fill="none"/>
          <path d="M300 40 Q310 200 305 380" stroke="#1a2540" strokeWidth="5" fill="none"/>
          <path d="M40 290 Q280 275 560 290" stroke="#1a2540" strokeWidth="5" fill="none"/>
          <text x="80" y="195" fill="#2a3a5e" fontSize="9" fontFamily="monospace">FEDERAL HWY</text>
          <text x="158" y="100" fill="#2a3a5e" fontSize="8" fontFamily="monospace" transform="rotate(90,158,100)">LDP</text>
        </svg>
        {centers.map(c=>{
          const x=toX(c.lng),y=toY(c.lat),wait=calcWait(c.queue,c.avgServiceTime),col=waitColor(wait),isHov=hovered===c.id;
          return (
            <div key={c.id} onClick={()=>onBook(c)} onMouseEnter={()=>setHovered(c.id)} onMouseLeave={()=>setHovered(null)} style={{position:"absolute",left:x-20,top:y-44,cursor:"pointer",zIndex:isHov?10:1,transition:"transform .2s",transform:isHov?"scale(1.15)":"scale(1)"}}>
              <div style={{background:"#13131f",border:`2px solid ${col}`,borderRadius:10,padding:"4px 8px",display:"flex",alignItems:"center",gap:5,boxShadow:`0 4px 20px ${col}44`,whiteSpace:"nowrap"}}>
                <span style={{fontSize:12}}>{c.icon}</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:10,fontWeight:700,color:"#fff"}}>{c.queue}</span>
                <span style={{fontSize:9,color:col}}>in queue</span>
              </div>
              <div style={{width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`8px solid ${col}`,margin:"0 auto"}}/>
              {isHov&&<div style={{position:"absolute",top:-95,left:"50%",transform:"translateX(-50%)",background:"#1a1a2e",border:"1px solid #2a2a3e",borderRadius:10,padding:"10px 14px",minWidth:170,boxShadow:"0 8px 24px rgba(0,0,0,.6)",zIndex:20}}>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:11,marginBottom:3}}>{c.name}</p>
                <p style={{fontSize:9,color:"#6b7280",marginBottom:4}}>{c.distance}km · {c.type}</p>
                <p style={{fontSize:12,color:col,fontWeight:700}}>Est. {fmtWait(wait)}</p>
                <p style={{fontSize:9,color:"#4b5563",marginTop:2}}>Click to book</p>
              </div>}
            </div>
          );
        })}
        <div style={{position:"absolute",bottom:14,left:14,background:"rgba(13,13,28,.92)",borderRadius:10,padding:"8px 12px",border:"1px solid #1e1e30",display:"flex",gap:12}}>
          {[["#4ade80","< 30m"],["#fbbf24","30–90m"],["#f87171","> 90m"]].map(([c,l])=>(
            <span key={l} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block"}}/><span style={{fontSize:9,color:"#9ca3af"}}>{l}</span></span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AUTH PAGES ───────────────────────────────────────────────────────────────
function Landing({onNavigate}){
  return (
    <div style={{minHeight:"100vh",background:"#080814",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"20%",left:"30%",width:500,height:500,background:"radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 65%)",borderRadius:"50%",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",padding:"0 20px",animation:"slideUp .6s ease",position:"relative",zIndex:1}}>
        <div style={{width:76,height:76,borderRadius:22,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 22px",boxShadow:"0 16px 48px rgba(99,102,241,.35)"}}>⏱️</div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:46,color:"#fff",letterSpacing:-2,lineHeight:1.1,marginBottom:10}}>Wait<span style={{background:"linear-gradient(90deg,#6366f1,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Wise</span></h1>
        <p style={{color:"#6b7280",fontSize:14,marginBottom:6,maxWidth:420,lineHeight:1.6,margin:"0 auto 6px"}}>Smart Service & Repair Queue Aggregator</p>
        <p style={{color:"#4b5563",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:44}}>Real-time queue info · Choose the most time-efficient location</p>
        <p style={{color:"#9ca3af",fontSize:13,marginBottom:18,fontFamily:"'Syne',sans-serif",fontWeight:600}}>How will you use WaitWise today?</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
          {[{role:"user",icon:"👤",title:"I'm a User",desc:"Find queues & book slots",grad:"linear-gradient(135deg,#6366f1,#8b5cf6)"},{role:"admin",icon:"⚙️",title:"I'm an Admin",desc:"Manage my service center",grad:"linear-gradient(135deg,#0891b2,#06b6d4)"}].map(r=>(
            <button key={r.role} onClick={()=>onNavigate("login",r.role)} style={{width:200,padding:"26px 20px",borderRadius:20,border:"1.5px solid #1e1e30",background:"#0d0d1c",cursor:"pointer",textAlign:"center",transition:"all .3s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#6366f1";e.currentTarget.style.transform="translateY(-4px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#1e1e30";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{width:52,height:52,borderRadius:14,background:r.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 12px",boxShadow:"0 8px 24px rgba(99,102,241,.25)"}}>{r.icon}</div>
              <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:15,marginBottom:5}}>{r.title}</p>
              <p style={{fontSize:11,color:"#6b7280"}}>{r.desc}</p>
            </button>
          ))}
        </div>
        <p style={{marginTop:30,fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:1.5}}>Prototype Demo · All data simulated</p>
      </div>
    </div>
  );
}

function LoginPage({role,onNavigate,onLogin}){
  const [email,setEmail]=useState(role==="admin"?"admin@demo.com":"user@demo.com");
  const [pass,setPass]=useState(role==="admin"?"admin123":"demo123");
  const [err,setErr]=useState("");
  const isAdmin=role==="admin";
  function submit(){const found=(isAdmin?DEMO_ADMINS:DEMO_USERS).find(u=>u.email===email&&u.password===pass);if(found)onLogin(found);else setErr("Invalid credentials. Use the pre-filled demo values.");}
  return (
    <div style={{minHeight:"100vh",background:"#080814",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:400,animation:"slideUp .35s ease"}}>
        <button onClick={()=>onNavigate("landing")} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:12,marginBottom:22,display:"flex",alignItems:"center",gap:6}}>← Back to Home</button>
        <div style={{background:"#0d0d1c",borderRadius:24,padding:36,border:"1px solid #1e1e30",boxShadow:"0 24px 80px rgba(0,0,0,.5)"}}>
          <div style={{textAlign:"center",marginBottom:26}}>
            <div style={{width:52,height:52,borderRadius:14,background:isAdmin?"linear-gradient(135deg,#0891b2,#06b6d4)":"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 12px"}}>{isAdmin?"⚙️":"👤"}</div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22}}>{isAdmin?"Admin Login":"User Login"}</h2>
            <p style={{color:"#6b7280",fontSize:11,marginTop:4}}>{isAdmin?"Manage your service center":"Find & book queue slots — WaitWise"}</p>
          </div>
          {err&&<div style={{background:"#1a0808",border:"1px solid #f87171",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#f87171"}}>{err}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:18}}>
            {[["Email",email,setEmail,"email"],["Password",pass,setPass,"password"]].map(([label,val,setter,type])=>(
              <div key={label}><label style={{fontSize:9,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>{label}</label><input type={type} value={val} onChange={e=>setter(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{width:"100%",background:"#161626",border:"1.5px solid #2a2a3e",borderRadius:11,padding:"11px 14px",color:"#fff",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none",boxSizing:"border-box"}}/></div>
            ))}
          </div>
          <button onClick={submit} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:isAdmin?"linear-gradient(135deg,#0891b2,#06b6d4)":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>Sign In →</button>
          <div style={{textAlign:"center",marginTop:14}}><span style={{fontSize:11,color:"#4b5563"}}>No account? </span><button onClick={()=>onNavigate("register",role)} style={{background:"none",border:"none",color:"#a5b4fc",fontSize:11,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600}}>Register</button></div>
          <div style={{marginTop:16,background:"#161626",borderRadius:10,padding:"10px 14px",border:"1px dashed #2a2a3e"}}>
            <p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Demo credentials (pre-filled)</p>
            <p style={{fontSize:10,color:"#6b7280",fontFamily:"'JetBrains Mono',monospace"}}>{isAdmin?"admin@demo.com / admin123":"user@demo.com / demo123"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterPage({role,onNavigate,onLogin}){
  const [form,setForm]=useState({name:"",email:"",password:"",phone:"",center:""});
  const isAdmin=role==="admin";
  function submit(){if(!form.name||!form.email||!form.password)return;onLogin({...form,role,centerId:1,center:form.center||"My Center"});}
  return (
    <div style={{minHeight:"100vh",background:"#080814",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:420,animation:"slideUp .35s ease"}}>
        <button onClick={()=>onNavigate("login",role)} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:12,marginBottom:22,display:"flex",alignItems:"center",gap:6}}>← Back to Login</button>
        <div style={{background:"#0d0d1c",borderRadius:24,padding:36,border:"1px solid #1e1e30"}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:20,marginBottom:5}}>{isAdmin?"⚙️ Register Service Center":"👤 Create Account"}</h2>
          <p style={{color:"#6b7280",fontSize:11,marginBottom:22}}>Join WaitWise today</p>
          <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:18}}>
            {[["Full Name","name","text"],["Email","email","email"],["Password","password","password"],["Phone","phone","text"],...(isAdmin?[["Service Center Name","center","text"]]:[])]
              .map(([label,key,type])=>(<div key={key}><label style={{fontSize:9,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>{label}</label><input type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} style={{width:"100%",background:"#161626",border:"1.5px solid #2a2a3e",borderRadius:11,padding:"10px 14px",color:"#fff",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none",boxSizing:"border-box"}}/></div>))}
          </div>
          <button onClick={submit} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>Create Account →</button>
        </div>
      </div>
    </div>
  );
}

// ─── USER DASHBOARD ───────────────────────────────────────────────────────────
function UserDashboard({user,centers,reviews,bookings,inbox,notifPrefs,notifThreshold,onLogout,onBook,onReview,onCancelSlot,onRedoSlot,onMarkRead,onMarkAllRead,onClearInbox,onSavePrefs,onSaveThreshold}){
  const [tab,setTab]=useState("home");
  const [filter,setFilter]=useState("All");
  const [sortBy,setSortBy]=useState("wait");
  const [search,setSearch]=useState("");
  const [bookingCenter,setBookingCenter]=useState(null);
  const [reviewCenter,setReviewCenter]=useState(null);
  const [showBell,setShowBell]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showSlotStatus,setShowSlotStatus]=useState(false);
  const [redoData,setRedoData]=useState(null);

  const maxWait=Math.max(...centers.map(c=>calcWait(c.queue,c.avgServiceTime)),1);
  const myBookings=bookings.filter(b=>b.userId===user.email);
  const unread=inbox.filter(n=>!n.read).length;
  const activeSlots=myBookings.filter(b=>b.slotStatus==="confirmed"||b.slotStatus==="pending").length;

  const filtered=centers
    .filter(c=>filter==="All"||c.type===filter)
    .filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||c.type.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>sortBy==="wait"?calcWait(a.queue,a.avgServiceTime)-calcWait(b.queue,b.avgServiceTime):sortBy==="distance"?a.distance-b.distance:b.rating-a.rating);

  function handleRedo(booking){
    const c=centers.find(x=>x.id===booking.centerId);
    if(c){setRedoData(booking);setBookingCenter(c);}
  }

  return (
    <div style={{minHeight:"100vh",background:"#080814"}}>
      {/* HEADER */}
      <header style={{background:"rgba(8,8,20,.93)",backdropFilter:"blur(20px)",borderBottom:"1px solid #1a1a2e",position:"sticky",top:0,zIndex:100,padding:"0 20px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:62}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⏱️</div>
            <div>
              <p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:16,color:"#fff",letterSpacing:-0.5}}>WaitWise</p>
              <p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5}}>User Dashboard</p>
            </div>
          </div>
          <nav style={{display:"flex",gap:2,background:"#0d0d1c",borderRadius:10,padding:3,border:"1px solid #1a1a2e"}}>
            {[["home","🏠 Home"],["map","🗺️ Map"],["slots","🎫 My Slots"],["reviews","⭐ Reviews"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)} style={{padding:"5px 13px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,background:tab===v?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent",color:tab===v?"#fff":"#6b7280",fontFamily:"'Syne',sans-serif",fontWeight:600,transition:"all .2s",position:"relative"}}>
                {l}
                {v==="slots"&&activeSlots>0&&<span style={{position:"absolute",top:-2,right:-2,background:"#6366f1",borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff",border:"2px solid #080814"}}>{activeSlots}</span>}
              </button>
            ))}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            <span style={{fontSize:9,color:"#4ade80",display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block",animation:"pulse 1.5s infinite"}}/>LIVE</span>
            <div style={{position:"relative"}}>
              <NotifBell inbox={inbox} onToggle={()=>{setShowBell(v=>!v);setShowProfile(false);}}/>
              {showBell&&<NotifInbox inbox={inbox} onClose={()=>setShowBell(false)} onMarkRead={onMarkRead} onMarkAllRead={onMarkAllRead} onClear={onClearInbox}/>}
            </div>
            <button onClick={()=>setShowSettings(true)} title="Notification Settings" style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>⚙️</button>
            <button onClick={()=>{setShowProfile(v=>!v);setShowBell(false);}} style={{display:"flex",alignItems:"center",gap:8,background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:10,padding:"6px 12px",cursor:"pointer"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>👤</div>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:12,color:"#d1d5db",fontWeight:600}}>{user.name.split(" ")[0]}</span>
            </button>
            {showProfile&&(
              <div style={{position:"fixed",top:70,right:20,background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:16,padding:20,zIndex:700,minWidth:220,boxShadow:"0 16px 48px rgba(0,0,0,.6)",animation:"slideDown .2s ease"}}>
                <div style={{textAlign:"center",marginBottom:14}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 8px"}}>👤</div>
                  <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:14}}>{user.name}</p>
                  <p style={{fontSize:10,color:"#6b7280"}}>{user.email}</p>
                </div>
                <div style={{background:"#161626",borderRadius:10,padding:"10px 12px",marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{label:"Active Slots",val:activeSlots,col:"#4ade80"},{label:"Unread",val:unread,col:"#fbbf24"}].map(s=>(
                    <div key={s.label} style={{textAlign:"center"}}>
                      <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:s.col}}>{s.val}</p>
                      <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1}}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <button onClick={()=>{setShowProfile(false);setShowSettings(true);}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1px solid #2a2a3e",background:"#161626",color:"#a5b4fc",fontFamily:"'Syne',sans-serif",fontWeight:600,cursor:"pointer",fontSize:12,marginBottom:8}}>🔔 Notification Settings</button>
                <button onClick={()=>{setShowProfile(false);onLogout();}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1px solid #2a2a3e",background:"none",color:"#f87171",fontFamily:"'Syne',sans-serif",fontWeight:600,cursor:"pointer",fontSize:12}}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{maxWidth:1100,margin:"0 auto",padding:"20px 20px 60px"}}>

        {/* HOME */}
        {tab==="home"&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
            {[{icon:"🏢",label:"Centers",val:centers.length},{icon:"⚡",label:"Lowest Wait",val:fmtWait(Math.min(...centers.map(c=>calcWait(c.queue,c.avgServiceTime))))},{icon:"🎫",label:"Open Slots",val:centers.reduce((a,c)=>a+c.slots-c.slotsBooked,0)},{icon:"✅",label:"My Active Slots",val:activeSlots}].map(s=>(
              <div key={s.label} style={{background:"#0d0d1c",borderRadius:14,padding:"14px 16px",border:"1px solid #1a1a2e"}}>
                <p style={{fontSize:18,marginBottom:4}}>{s.icon}</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#fff"}}>{s.val}</p>
                <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1}}>{s.label}</p>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{position:"relative",flex:1,minWidth:200}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#4b5563"}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search centers or service type…" style={{width:"100%",background:"#0d0d1c",border:"1px solid #1a1a2e",borderRadius:11,padding:"9px 14px 9px 36px",color:"#fff",fontSize:12,fontFamily:"'JetBrains Mono',monospace",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:"#0d0d1c",border:"1px solid #1a1a2e",borderRadius:9,color:"#9ca3af",fontSize:10,padding:"9px 10px",fontFamily:"'JetBrains Mono',monospace",cursor:"pointer"}}>
              <option value="wait">⚡ Fastest</option><option value="distance">📍 Nearest</option><option value="rating">⭐ Top Rated</option>
            </select>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {SERVICE_TYPES.map(t=><button key={t} onClick={()=>setFilter(t)} style={{padding:"5px 13px",borderRadius:20,border:`1px solid ${filter===t?"#6366f1":"#1a1a2e"}`,background:filter===t?"#1e1b4b":"#0d0d1c",color:filter===t?"#a5b4fc":"#6b7280",fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",transition:"all .2s"}}>{t}</button>)}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filtered.length===0&&<div style={{background:"#0d0d1c",borderRadius:16,padding:40,textAlign:"center",border:"1px dashed #1a1a2e"}}><p style={{color:"#6b7280",fontFamily:"'Syne',sans-serif",fontSize:14}}>No centers match your search.</p></div>}
            {filtered.map((c,i)=>{
              const wait=calcWait(c.queue,c.avgServiceTime),isBest=i===0&&sortBy==="wait"&&!search;
              const slotsLeft=c.slots-c.slotsBooked;
              const slotPct=(c.slotsBooked/c.slots)*100;
              const slotStatusColor=slotsLeft===0?"#f87171":slotsLeft<=3?"#fbbf24":"#4ade80";
              const slotStatusLabel=slotsLeft===0?"Full":slotsLeft<=3?`${slotsLeft} left`:`${slotsLeft} available`;
              return (
                <div key={c.id} style={{background:"#0d0d1c",borderRadius:18,padding:20,border:`1.5px solid ${isBest?"#6366f1":"#1a1a2e"}`,boxShadow:isBest?"0 0 28px rgba(99,102,241,.1)":"none",display:"grid",gridTemplateColumns:"auto 1fr auto",gap:18,alignItems:"center",position:"relative",overflow:"hidden"}}>
                  {isBest&&<div style={{position:"absolute",top:0,right:0,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"0 18px 0 10px",padding:"4px 14px",fontSize:9,fontWeight:700,color:"#fff",fontFamily:"'Syne',sans-serif"}}>⚡ BEST CHOICE</div>}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <div style={{width:48,height:48,borderRadius:13,background:"#161626",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"1px solid #1e1e30"}}>{c.icon}</div>
                    <WaitRing wait={wait} maxWait={maxWait}/>
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:"#fff"}}>{c.name}</h3>
                      <span style={{background:"#161626",borderRadius:5,padding:"2px 7px",fontSize:8,color:"#6b7280",textTransform:"uppercase",letterSpacing:1}}>{c.type}</span>
                      <span style={{background:c.status==="open"?"#052e16":"#2e0a0a",color:c.status==="open"?"#4ade80":"#f87171",borderRadius:5,padding:"2px 7px",fontSize:8,fontWeight:700,textTransform:"uppercase"}}>{c.status}</span>
                    </div>
                    <p style={{fontSize:9,color:"#4b5563",marginBottom:10}}>📍 {c.address} · {c.distance}km</p>
                    <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-end"}}>
                      {[{label:"Queue",val:c.queue,col:"#fbbf24"},{label:"Avg/Person",val:`${c.avgServiceTime}m`,col:"#fff"},{label:"Est. Wait",val:fmtWait(wait),col:waitColor(wait)}].map(s=>(
                        <div key={s.label}><p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{s.label}</p><p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:s.col}}>{s.val}</p></div>
                      ))}
                      <div><p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Crowd</p><div style={{display:"flex",alignItems:"center",gap:5}}><CrowdBars level={c.crowd}/><span style={{fontSize:10,color:CROWD[c.crowd].color}}>{CROWD[c.crowd].label}</span></div></div>
                      <div><p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Rating</p><div style={{display:"flex",alignItems:"center",gap:4}}><StarRow rating={c.rating}/><span style={{fontSize:10,color:"#9ca3af"}}>{c.rating}</span></div></div>
                    </div>

                    {/* ── SLOT STATUS FEATURE ── */}
                    <div style={{marginTop:12,background:"#161626",borderRadius:12,padding:"10px 14px",border:"1px solid #1e1e30"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                        <p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1}}>🎫 Slot Availability</p>
                        <span style={{fontSize:10,fontWeight:700,color:slotStatusColor,fontFamily:"'Syne',sans-serif"}}>{slotStatusLabel}</span>
                      </div>
                      <div style={{background:"#0d0d1c",borderRadius:5,height:6,overflow:"hidden",marginBottom:5}}>
                        <div style={{height:"100%",borderRadius:5,width:`${slotPct}%`,background:slotPct>=100?"#ef4444":slotPct>70?"linear-gradient(90deg,#fbbf24,#f59e0b)":"linear-gradient(90deg,#4ade80,#22c55e)",transition:"width .5s"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:8,color:"#374151"}}>{c.slotsBooked}/{c.slots} slots filled</span>
                        <span style={{fontSize:8,color:slotStatusColor,fontWeight:600}}>{Math.round(slotPct)}% capacity</span>
                      </div>
                    </div>
                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <button onClick={()=>setBookingCenter(c)} style={{padding:"10px 18px",borderRadius:10,border:"none",background:slotsLeft>0&&c.status==="open"?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#1e1e2e",color:slotsLeft>0&&c.status==="open"?"#fff":"#4b5563",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,cursor:slotsLeft>0&&c.status==="open"?"pointer":"not-allowed",whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(99,102,241,.25)"}}>
                      {c.status!=="open"?"Closed":slotsLeft>0?"Book Slot →":"Full"}
                    </button>
                    <button onClick={()=>setReviewCenter(c)} style={{padding:"8px 18px",borderRadius:10,border:"1px solid #2a2a3e",background:"none",color:"#9ca3af",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:11,cursor:"pointer"}}>Rate ★</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* MAP */}
        {tab==="map"&&<>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22,marginBottom:16}}>🗺️ Live Service Map</h2>
          <MapView centers={centers} onBook={setBookingCenter}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {centers.map(c=>{const wait=calcWait(c.queue,c.avgServiceTime);return(
              <div key={c.id} style={{background:"#0d0d1c",borderRadius:14,padding:16,border:"1px solid #1a1a2e",cursor:"pointer",transition:"all .2s"}} onClick={()=>setBookingCenter(c)}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#6366f1"} onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a2e"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <span style={{fontSize:24}}>{c.icon}</span>
                  <span style={{fontSize:12,color:waitColor(wait),fontWeight:700,fontFamily:"'Syne',sans-serif"}}>{fmtWait(wait)}</span>
                </div>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:12,marginBottom:2}}>{c.name}</p>
                <p style={{fontSize:9,color:"#4b5563",marginBottom:8}}>{c.distance}km · Queue: {c.queue}</p>
                <div style={{background:"#161626",borderRadius:4,height:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(wait/Math.max(...centers.map(c=>calcWait(c.queue,c.avgServiceTime)),1))*100}%`,background:waitColor(wait),borderRadius:4,transition:"width .5s"}}/>
                </div>
              </div>
            );})}
          </div>
        </>}

        {/* MY SLOTS */}
        {tab==="slots"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22}}>🎫 My Slot Status</h2>
              <p style={{color:"#6b7280",fontSize:11,marginTop:4}}>View, cancel, or re-book your slots</p>
            </div>
            <div style={{display:"flex",gap:8}}>
              {Object.entries(SLOT_STATUS).map(([k,v])=>(
                <span key={k} style={{background:v.bg,color:v.color,border:`1px solid ${v.color}33`,borderRadius:8,padding:"4px 10px",fontSize:9,fontWeight:700}}>
                  {v.icon} {myBookings.filter(b=>b.slotStatus===k).length} {v.label}
                </span>
              ))}
            </div>
          </div>

          {myBookings.length===0?(
            <div style={{background:"#0d0d1c",borderRadius:18,padding:48,border:"1px dashed #1a1a2e",textAlign:"center"}}>
              <p style={{fontSize:44,marginBottom:12}}>🎫</p>
              <p style={{fontFamily:"'Syne',sans-serif",color:"#6b7280",fontSize:15}}>No bookings yet</p>
              <p style={{fontSize:11,color:"#4b5563",marginTop:4}}>Go to Home and book a slot at a service center</p>
              <button onClick={()=>setTab("home")} style={{marginTop:16,padding:"10px 22px",borderRadius:11,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>Browse Centers →</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {["confirmed","pending","cancelled","completed"].map(status=>{
                const group=myBookings.filter(b=>b.slotStatus===status);
                if(group.length===0)return null;
                const sv=SLOT_STATUS[status];
                return (
                  <div key={status}>
                    <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                      <span style={{background:sv.bg,color:sv.color,borderRadius:5,padding:"2px 8px",border:`1px solid ${sv.color}33`}}>{sv.icon} {sv.label}</span>
                      <span>— {group.length} slot{group.length!==1?"s":""}</span>
                    </p>
                    {group.map((b,i)=>{
                      const isActive=status==="confirmed"||status==="pending";
                      return (
                        <div key={b.id||i} style={{background:isActive?"#0d0d1c":"#090915",borderRadius:16,padding:18,border:`1px solid ${isActive?"#1e1e30":"#141420"}`,display:"grid",gridTemplateColumns:"auto 1fr auto",gap:14,alignItems:"center",marginBottom:10,opacity:isActive?1:0.8}}>
                          <div style={{width:46,height:46,borderRadius:12,background:"#161626",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:"1px solid #1a1a2e",filter:!isActive?"grayscale(0.5)":"none"}}>{b.centerIcon}</div>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                              <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:isActive?"#fff":"#6b7280",fontSize:14}}>{b.centerName}</p>
                              <SlotBadge status={b.slotStatus}/>
                            </div>
                            <p style={{fontSize:10,color:"#6b7280"}}>📅 Slot: <b style={{color:isActive?"#a5b4fc":"#6b7280"}}>{b.slot}</b> · Booked at {b.bookedAt}</p>
                            <p style={{fontSize:9,color:"#4b5563",marginTop:2}}>Wait at time of booking: ~{b.waitAtBook}m</p>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                            {isActive&&(
                              <button onClick={()=>onCancelSlot(b.id)} style={{padding:"8px 14px",borderRadius:9,border:"1px solid #2e1a1a",background:"#1a0808",color:"#f87171",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>Cancel ✕</button>
                            )}
                            {status==="cancelled"&&(
                              <button onClick={()=>handleRedo(b)} style={{padding:"8px 14px",borderRadius:9,border:"1px solid #1a2e1a",background:"#0a1a0a",color:"#4ade80",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>Re-book 🔄</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>}

        {/* REVIEWS */}
        {tab==="reviews"&&<>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22,marginBottom:16}}>⭐ Reviews & Ratings</h2>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {centers.map(c=>(
              <div key={c.id} style={{background:"#0d0d1c",borderRadius:18,padding:20,border:"1px solid #1a1a2e"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:24}}>{c.icon}</span>
                    <div><p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:14}}>{c.name}</p><div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}><StarRow rating={c.rating}/><span style={{fontSize:11,color:"#9ca3af"}}>{c.rating} ({(reviews[c.id]||[]).length} reviews)</span></div></div>
                  </div>
                  <button onClick={()=>setReviewCenter(c)} style={{padding:"7px 14px",borderRadius:9,border:"1px solid #2a2a3e",background:"#161626",color:"#a5b4fc",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:11,cursor:"pointer"}}>+ Add Review</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(reviews[c.id]||[]).map((r,i)=>(
                    <div key={i} style={{background:"#161626",borderRadius:11,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{fontFamily:"'Syne',sans-serif",fontWeight:600,color:"#d1d5db",fontSize:12}}>{r.user}</span><StarRow rating={r.rating}/></div>{r.comment&&<p style={{fontSize:11,color:"#6b7280",lineHeight:1.5}}>{r.comment}</p>}</div>
                      <span style={{fontSize:9,color:"#374151",whiteSpace:"nowrap",marginLeft:10}}>{r.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>}
      </main>

      {bookingCenter&&<BookingModal center={bookingCenter} user={user} onClose={()=>{setBookingCenter(null);setRedoData(null);}} onBook={onBook} redoData={redoData}/>}
      {reviewCenter&&<ReviewModal center={reviewCenter} user={user} onClose={()=>setReviewCenter(null)} onSubmit={onReview}/>}
      {showSettings&&<NotifSettings prefs={notifPrefs} threshold={notifThreshold} onPrefsChange={onSavePrefs} onThresholdChange={onSaveThreshold} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard({user,centers,bookings,reviews,inbox,notifPrefs,notifThreshold,onLogout,onUpdateQueue,onToggleStatus,onMarkRead,onMarkAllRead,onClearInbox,onSavePrefs,onSaveThreshold}){
  const [tab,setTab]=useState("control");
  const [showBell,setShowBell]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const myCenter=centers.find(c=>c.id===user.centerId)||centers[0];
  const maxWait=Math.max(...centers.map(c=>calcWait(c.queue,c.avgServiceTime)),1);
  const unread=inbox.filter(n=>!n.read).length;

  return (
    <div style={{minHeight:"100vh",background:"#080814"}}>
      <header style={{background:"rgba(8,8,20,.93)",backdropFilter:"blur(20px)",borderBottom:"1px solid #1a1a2e",position:"sticky",top:0,zIndex:100,padding:"0 20px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:62}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#0891b2,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⏱️</div>
            <div><p style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:16,color:"#fff",letterSpacing:-0.5}}>WaitWise Admin</p><p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1.5}}>{myCenter.name}</p></div>
          </div>
          <nav style={{display:"flex",gap:2,background:"#0d0d1c",borderRadius:10,padding:3,border:"1px solid #1a1a2e"}}>
            {[["control","🎛️ Control"],["analytics","📊 Analytics"],["slots","🎫 Slots"],["reviews","⭐ Reviews"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)} style={{padding:"5px 13px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,background:tab===v?"linear-gradient(135deg,#0891b2,#06b6d4)":"transparent",color:tab===v?"#fff":"#6b7280",fontFamily:"'Syne',sans-serif",fontWeight:600,transition:"all .2s"}}>{l}</button>
            ))}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
            <div style={{position:"relative"}}>
              <NotifBell inbox={inbox} onToggle={()=>{setShowBell(v=>!v);setShowProfile(false);}}/>
              {showBell&&<NotifInbox inbox={inbox} onClose={()=>setShowBell(false)} onMarkRead={onMarkRead} onMarkAllRead={onMarkAllRead} onClear={onClearInbox}/>}
            </div>
            <button onClick={()=>setShowSettings(true)} style={{background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>⚙️</button>
            <button onClick={()=>{setShowProfile(v=>!v);setShowBell(false);}} style={{display:"flex",alignItems:"center",gap:8,background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:10,padding:"6px 12px",cursor:"pointer"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#0891b2,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>⚙️</div>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:12,color:"#d1d5db",fontWeight:600}}>{user.name.split(" ")[0]}</span>
            </button>
            {showProfile&&(
              <div style={{position:"fixed",top:70,right:20,background:"#0d0d1c",border:"1px solid #1e1e30",borderRadius:16,padding:20,zIndex:700,minWidth:220,boxShadow:"0 16px 48px rgba(0,0,0,.6)",animation:"slideDown .2s ease"}}>
                <div style={{textAlign:"center",marginBottom:14}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#0891b2,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 8px"}}>⚙️</div>
                  <p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:14}}>{user.name}</p>
                  <p style={{fontSize:10,color:"#6b7280"}}>{user.email}</p>
                  <p style={{fontSize:10,color:"#06b6d4",marginTop:2}}>{myCenter.name}</p>
                </div>
                <button onClick={()=>{setShowProfile(false);setShowSettings(true);}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1px solid #2a2a3e",background:"#161626",color:"#a5b4fc",fontFamily:"'Syne',sans-serif",fontWeight:600,cursor:"pointer",fontSize:12,marginBottom:8}}>🔔 Notification Settings</button>
                <button onClick={()=>{setShowProfile(false);onLogout();}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1px solid #2a2a3e",background:"none",color:"#f87171",fontFamily:"'Syne',sans-serif",fontWeight:600,cursor:"pointer",fontSize:12}}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{maxWidth:1100,margin:"0 auto",padding:"20px 20px 60px"}}>
        {tab==="control"&&<>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22,marginBottom:18}}>🎛️ Queue Control Panel</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{background:"#0d0d1c",borderRadius:18,padding:24,border:"1px solid #1a1a2e"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:15}}>{myCenter.icon} {myCenter.name}</h3>
                <button onClick={()=>onToggleStatus(myCenter.id)} style={{padding:"6px 14px",borderRadius:9,border:`1px solid ${myCenter.status==="open"?"#4ade8033":"#f8717133"}`,background:myCenter.status==="open"?"#052e16":"#2e0a0a",color:myCenter.status==="open"?"#4ade80":"#f87171",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,cursor:"pointer"}}>
                  {myCenter.status==="open"?"🟢 Open — Close?":"🔴 Closed — Open?"}
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[{label:"Current Queue",val:myCenter.queue,col:"#fbbf24"},{label:"Est. Wait",val:fmtWait(calcWait(myCenter.queue,myCenter.avgServiceTime)),col:waitColor(calcWait(myCenter.queue,myCenter.avgServiceTime))},{label:"Slots Booked",val:`${myCenter.slotsBooked}/${myCenter.slots}`,col:"#a78bfa"},{label:"Avg Svc Time",val:`${myCenter.avgServiceTime}m`,col:"#60a5fa"}].map(s=>(
                  <div key={s.label} style={{background:"#161626",borderRadius:12,padding:"12px 14px",border:"1px solid #1e1e30"}}>
                    <p style={{fontSize:8,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.label}</p>
                    <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:s.col}}>{s.val}</p>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
                <label style={{fontSize:9,color:"#9ca3af",textTransform:"uppercase",letterSpacing:1,whiteSpace:"nowrap"}}>Queue Count</label>
                <input type="number" min={0} value={myCenter.queue} onChange={e=>onUpdateQueue(myCenter.id,parseInt(e.target.value)||0)} style={{flex:1,background:"#161626",border:"1.5px solid #2a2a3e",borderRadius:10,color:"#fbbf24",fontSize:22,padding:"8px 14px",fontFamily:"'Syne',sans-serif",fontWeight:800,outline:"none"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                {[["−5",-5],["−1",-1],["+1",1],["+5",5]].map(([l,d])=>(
                  <button key={l} onClick={()=>onUpdateQueue(myCenter.id,Math.max(0,myCenter.queue+d))} style={{padding:10,borderRadius:10,border:`1px solid ${d>0?"#1a2e1a":"#2e1a1a"}`,background:d>0?"#0a1a0a":"#1a0a0a",color:d>0?"#4ade80":"#f87171",fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,cursor:"pointer"}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{background:"#0d0d1c",borderRadius:18,padding:24,border:"1px solid #1a1a2e"}}>
              <p style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>🔔 Live Activity Feed</p>
              {[{time:"Just now",msg:"Queue synced — live update pushed",icon:"🔄"},{time:"2m ago",msg:`Slot booked at ${myCenter.name}`,icon:"✅"},{time:"5m ago",msg:"Crowd level auto-updated",icon:"📊"},{time:"8m ago",msg:"Slot cancellation received",icon:"❌"},{time:"11m ago",msg:"New 5-star review received",icon:"⭐"},{time:"16m ago",msg:"Admin signed in to WaitWise",icon:"🔐"}].map((a,i,arr)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<arr.length-1?"1px solid #1a1a2e":"none"}}>
                  <span style={{fontSize:14}}>{a.icon}</span>
                  <div><p style={{fontSize:11,color:"#d1d5db",lineHeight:1.4}}>{a.msg}</p><p style={{fontSize:9,color:"#4b5563",marginTop:2}}>{a.time}</p></div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {tab==="analytics"&&<>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22,marginBottom:18}}>📊 Analytics Dashboard</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
            {[{icon:"👥",label:"Total in Queue",val:centers.reduce((a,c)=>a+c.queue,0),col:"#fbbf24"},{icon:"🎫",label:"Slots Filled",val:centers.reduce((a,c)=>a+c.slotsBooked,0),col:"#a78bfa"},{icon:"⚡",label:"Avg Wait",val:fmtWait(Math.round(centers.reduce((a,c)=>a+calcWait(c.queue,c.avgServiceTime),0)/centers.length)),col:"#60a5fa"},{icon:"⭐",label:"Avg Rating",val:(centers.reduce((a,c)=>a+c.rating,0)/centers.length).toFixed(1),col:"#4ade80"}].map(s=>(
              <div key={s.label} style={{background:"#0d0d1c",borderRadius:14,padding:16,border:"1px solid #1a1a2e"}}>
                <p style={{fontSize:20,marginBottom:5}}>{s.icon}</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:s.col}}>{s.val}</p>
                <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{background:"#0d0d1c",borderRadius:18,padding:24,border:"1px solid #1a1a2e",marginBottom:14}}>
            <p style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>⏱️ Wait Times — All Centers</p>
            {centers.map(c=>{const w=calcWait(c.queue,c.avgServiceTime),pct=(w/maxWait)*100;return(
              <div key={c.id} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:"#9ca3af"}}>{c.icon} {c.name}</span><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:10,color:"#6b7280"}}>Q:{c.queue}</span><span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,color:waitColor(w)}}>{fmtWait(w)}</span></div></div>
                <div style={{background:"#161626",borderRadius:6,height:10,overflow:"hidden"}}><div style={{height:"100%",borderRadius:6,width:`${pct}%`,background:waitColor(w),transition:"width .6s"}}/></div>
              </div>
            );})}
          </div>
          <div style={{background:"#0d0d1c",borderRadius:18,padding:24,border:"1px solid #1a1a2e"}}>
            <p style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:1.5,marginBottom:16}}>🎫 Slot Utilization</p>
            {centers.map(c=>{const pct=(c.slotsBooked/c.slots)*100;return(
              <div key={c.id} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:"#9ca3af"}}>{c.icon} {c.name}</span><span style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,color:pct>85?"#f87171":"#a78bfa"}}>{Math.round(pct)}%</span></div>
                <div style={{background:"#161626",borderRadius:6,height:10,overflow:"hidden"}}><div style={{height:"100%",borderRadius:6,width:`${pct}%`,background:pct>85?"linear-gradient(90deg,#f87171,#ef4444)":"linear-gradient(90deg,#6366f1,#a78bfa)",transition:"width .6s"}}/></div>
                <p style={{fontSize:8,color:"#374151",marginTop:2}}>{c.slotsBooked}/{c.slots} · {c.slots-c.slotsBooked} remaining</p>
              </div>
            );})}
          </div>
        </>}

        {tab==="slots"&&<>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22,marginBottom:6}}>🎫 All Bookings — Slot Status</h2>
          <p style={{color:"#6b7280",fontSize:11,marginBottom:18}}>Overview of all slot statuses across all users and centers</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
            {Object.entries(SLOT_STATUS).map(([k,v])=>{const count=bookings.filter(b=>b.slotStatus===k).length;return(
              <div key={k} style={{background:"#0d0d1c",borderRadius:14,padding:16,border:`1px solid ${v.color}22`}}>
                <p style={{fontSize:22,marginBottom:6}}>{v.icon}</p>
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:v.color}}>{count}</p>
                <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{v.label}</p>
              </div>
            );})}
          </div>
          {bookings.length===0?(
            <div style={{background:"#0d0d1c",borderRadius:18,padding:40,border:"1px dashed #1a1a2e",textAlign:"center"}}><p style={{fontFamily:"'Syne',sans-serif",color:"#6b7280",fontSize:14}}>No bookings yet.</p></div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {bookings.map((b,i)=>(
                <div key={b.id||i} style={{background:"#0d0d1c",borderRadius:14,padding:16,border:"1px solid #1a1a2e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:22}}>{b.centerIcon}</span>
                    <div><p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:13}}>{b.centerName}</p><p style={{fontSize:10,color:"#6b7280"}}>User: {b.userId} · Slot: {b.slot} · {b.bookedAt}</p></div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <SlotBadge status={b.slotStatus}/>
                    <p style={{fontSize:9,color:"#4b5563"}}>~{b.waitAtBook}m wait</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}

        {tab==="reviews"&&<>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#fff",fontSize:22,marginBottom:16}}>⭐ Center Reviews</h2>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {centers.map(c=>(
              <div key={c.id} style={{background:"#0d0d1c",borderRadius:18,padding:20,border:"1px solid #1a1a2e"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><span style={{fontSize:22}}>{c.icon}</span><div><p style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#fff",fontSize:14}}>{c.name}</p><div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}><StarRow rating={c.rating}/><span style={{fontSize:10,color:"#9ca3af"}}>{c.rating}</span></div></div></div>
                {(reviews[c.id]||[]).map((r,i)=>(
                  <div key={i} style={{background:"#161626",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontFamily:"'Syne',sans-serif",fontWeight:600,color:"#d1d5db",fontSize:12}}>{r.user}</span><div style={{display:"flex",alignItems:"center",gap:6}}><StarRow rating={r.rating}/><span style={{fontSize:9,color:"#4b5563"}}>{r.date}</span></div></div>
                    {r.comment&&<p style={{fontSize:11,color:"#6b7280"}}>{r.comment}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>}
      </main>
      {showSettings&&<NotifSettings prefs={notifPrefs} threshold={notifThreshold} onPrefsChange={onSavePrefs} onThresholdChange={onSaveThreshold} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("landing");
  const [authRole,setAuthRole]=useState("user");
  const [currentUser,setCurrentUser]=useState(null);
  const [centers,setCenters]=useState(INIT_CENTERS);
  const [reviews,setReviews]=useState(SAMPLE_REVIEWS);
  const [bookings,setBookings]=useState([]); // unified bookings with slotStatus
  const [inbox,setInbox]=useState([]);
  const [notifPrefs,setNotifPrefs]=useState(DEFAULT_PREFS);
  const [notifThreshold,setNotifThreshold]=useState(DEFAULT_THRESHOLD);

  const prevWaits=useRef({});

  const pushInbox=useCallback((title,msg,icon,type="info")=>{
    setInbox(prev=>[{id:uid(),title,msg,icon,type,time:tsNow(),read:false},...prev].slice(0,50));
  },[]);

  // Live auto-tick
  useEffect(()=>{
    const iv=setInterval(()=>{
      setCenters(prev=>{
        const next=prev.map(c=>{
          const delta=Math.random()<.45?(Math.random()<.5?1:-1):0;
          const nq=Math.max(0,c.queue+delta);
          return{...c,queue:nq,crowd:nq<=3?"low":nq<=8?"medium":"high"};
        });
        next.forEach(c=>{
          const wait=calcWait(c.queue,c.avgServiceTime);
          const prevWait=prevWaits.current[c.id]??wait+1;
          if(notifPrefs.waitThreshold?.enabled&&prevWait>notifThreshold&&wait<=notifThreshold)
            pushInbox(`⚡ Wait Dropped — ${c.name}`,`Wait is now ${fmtWait(wait)}, below your ${notifThreshold}m threshold!`,"⚡","threshold");
          if(notifPrefs.queueAlmostDone?.enabled&&c.queue===1&&(prevWaits.current[c.id]??2)>1)
            pushInbox(`🔔 You're Next! — ${c.name}`,"Only 1 person ahead. Get ready!","🔔","queue");
          prevWaits.current[c.id]=wait;
        });
        return next;
      });
    },5000);
    return ()=>clearInterval(iv);
  },[notifPrefs,notifThreshold,pushInbox]);

  function navigate(pg,role){if(role)setAuthRole(role);setPage(pg);}

  function login(user){
    setCurrentUser(user);setPage("app");
    if(notifPrefs.slotConfirmed?.enabled)pushInbox(`Welcome back, ${user.name.split(" ")[0]}! 👋`,"You're signed in to WaitWise.","✅","system");
  }
  function logout(){setCurrentUser(null);setPage("landing");setInbox([]);}

  function handleBook(centerId,slot){
    const c=centers.find(x=>x.id===centerId);
    setCenters(prev=>prev.map(x=>x.id===centerId?{...x,queue:x.queue+1,slotsBooked:Math.min(x.slotsBooked+1,x.slots)}:x));
    const entry={id:uid(),centerId,centerName:c.name,centerIcon:c.icon,slot,bookedAt:tsNow(),waitAtBook:calcWait(c.queue,c.avgServiceTime),userId:currentUser?.email||"guest",slotStatus:"confirmed"};
    setBookings(prev=>[entry,...prev]);
    if(notifPrefs.slotConfirmed?.enabled)pushInbox("✅ Slot Confirmed!",`Booked at ${c.name} for ${slot}. Est. wait: ${fmtWait(calcWait(c.queue,c.avgServiceTime))}.`,"✅","booking");
  }

  function handleCancelSlot(bookingId){
    setBookings(prev=>prev.map(b=>b.id===bookingId?{...b,slotStatus:"cancelled"}:b));
    const b=bookings.find(x=>x.id===bookingId);
    setCenters(prev=>prev.map(c=>c.id===b?.centerId?{...c,queue:Math.max(0,c.queue-1),slotsBooked:Math.max(0,c.slotsBooked-1)}:c));
    pushInbox("❌ Slot Cancelled",`Your slot has been cancelled. You can re-book anytime.`,"❌","cancel");
  }

  function handleRedoSlot(oldBooking){
    // Just opens modal with pre-filled slot via redoData — actual re-booking via handleBook
    setBookings(prev=>prev.map(b=>b.id===oldBooking.id?{...b,slotStatus:"cancelled"}:b));
  }

  function handleReview(centerId,review){setReviews(prev=>({...prev,[centerId]:[review,...(prev[centerId]||[])]}));}
  function handleUpdateQueue(id,val){const nq=Math.max(0,val);setCenters(prev=>prev.map(c=>c.id===id?{...c,queue:nq,crowd:nq<=3?"low":nq<=8?"medium":"high"}:c));}
  function handleToggleStatus(id){
    setCenters(prev=>prev.map(c=>{
      if(c.id!==id)return c;
      const next={...c,status:c.status==="open"?"closed":"open"};
      if(notifPrefs.centerStatus?.enabled)pushInbox(`🏢 ${c.name} is now ${next.status.toUpperCase()}`,next.status==="open"?"Reopened — slots available.":"Closed — please choose another.","🏢","status");
      return next;
    }));
  }
  function handleSavePrefs(key,enabled){setNotifPrefs(prev=>({...prev,[key]:{...prev[key],enabled}}));}

  const markRead=id=>setInbox(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
  const markAllRead=()=>setInbox(prev=>prev.map(n=>({...n,read:true})));
  const clearInbox=()=>setInbox([]);

  const sharedProps={inbox,notifPrefs,notifThreshold,onMarkRead:markRead,onMarkAllRead:markAllRead,onClearInbox:clearInbox,onSavePrefs:handleSavePrefs,onSaveThreshold:setNotifThreshold};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#080814;color:#fff;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pop{0%{transform:scale(.5)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#080814}::-webkit-scrollbar-thumb{background:#2a2a3e;border-radius:4px}
        input,textarea,select{color-scheme:dark;}
        button:active{transform:scale(.97);}
        input[type=range]{height:4px;border-radius:4px;}
      `}</style>

      {page==="landing"&&<Landing onNavigate={navigate}/>}
      {page==="login"&&<LoginPage role={authRole} onNavigate={navigate} onLogin={login}/>}
      {page==="register"&&<RegisterPage role={authRole} onNavigate={navigate} onLogin={login}/>}
      {page==="app"&&currentUser?.role==="user"&&(
        <UserDashboard user={currentUser} centers={centers} reviews={reviews} bookings={bookings} onLogout={logout} onBook={handleBook} onReview={handleReview} onCancelSlot={handleCancelSlot} onRedoSlot={handleRedoSlot} {...sharedProps}/>
      )}
      {page==="app"&&currentUser?.role==="admin"&&(
        <AdminDashboard user={currentUser} centers={centers} bookings={bookings} reviews={reviews} onLogout={logout} onUpdateQueue={handleUpdateQueue} onToggleStatus={handleToggleStatus} {...sharedProps}/>
      )}
    </>
  );
}
