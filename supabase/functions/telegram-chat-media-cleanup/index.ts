import {createClient} from "npm:@supabase/supabase-js@2.57.0";

// Invoke from a trusted scheduler with Authorization: Bearer <MEDIA_CLEANUP_SECRET>.
// Never expose this endpoint to browsers or use the anon key for cleanup.
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const secret=Deno.env.get("MEDIA_CLEANUP_SECRET");
 if(!secret||secret.length<32||req.headers.get("authorization")!=="Bearer "+secret)
  return new Response("Unauthorized",{status:401});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const cutoff=Date.now()-48*3600000;
 let deleted=0,scanned=0;
 // Bucket object names are namespaced by user UUID; list all prefixes and pages.
 const {data:users,error:rootError}=await db.storage.from("telegram-chat-media").list("",{limit:1000});
 if(rootError)throw rootError;
 for(const folder of users||[]){
  if(!/^[0-9a-f-]{36}$/i.test(folder.name))continue;
  let offset=0;
  for(;;){
   const {data:files,error}=await db.storage.from("telegram-chat-media").list(folder.name,{limit:100,offset,sortBy:{column:"name",order:"asc"}});
   if(error)throw error;
   if(!files?.length)break;
   const stale=files.filter(f=>f.id&&f.created_at&&Date.parse(f.created_at)<cutoff).map(f=>folder.name+"/"+f.name);
   scanned+=files.length;
   if(stale.length){
    const {error:removeError}=await db.storage.from("telegram-chat-media").remove(stale);
    if(removeError)throw removeError;
    deleted+=stale.length;
    // Re-list from this page after deletion to avoid skipping entries.
    continue;
   }
   offset+=files.length;
   if(files.length<100)break;
  }
 }
 return Response.json({success:true,scanned,deleted});
});
