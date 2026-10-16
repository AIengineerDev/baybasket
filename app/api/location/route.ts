import {resolveLocation} from '../../../lib/place-resolver';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams.get('q')||'';
 const location=await resolveLocation(query);
 if(!location)return Response.json({error:'Enter a supported city or a ZIP code in Tampa Bay, Silicon Valley or San Francisco. We could not resolve that location.'},{status:400});
 return Response.json({location},{headers:{'Cache-Control':'private, max-age=3600'}});
}
