export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({error:"POST only"});
 const {prompt}=req.body||{};
 if(!prompt) return res.status(400).json({error:"Missing prompt"});
 const apiKey=process.env.OPENAI_API_KEY;
 if(!apiKey) return res.status(500).json({error:"Missing OPENAI_API_KEY"});

 const r=await fetch("https://api.openai.com/v1/chat/completions",{
  method:"POST",
  headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
  body:JSON.stringify({
   model:"gpt-4o-mini",
   messages:[
    {role:"system",content:"You are an elderly care service user speaking Japanese."},
    {role:"user",content:prompt}
   ]
  })
 });
 const d=await r.json();
 return res.status(200).json({text:d.choices?.[0]?.message?.content||""});
}
