Kaigo Sensei - LP + App + OpenAI API

1) Vercel Environment Variables:
   OPENAI_API_KEY = your OpenAI API key

2) Deploy:
   - Put this repository at root.
   - Ensure Vercel Project Settings > Root Directory is '.' (empty)
   - Redeploy after setting OPENAI_API_KEY.

Routes:
 - /           LP
 - /app        App
 - /api/chat   Serverless API
