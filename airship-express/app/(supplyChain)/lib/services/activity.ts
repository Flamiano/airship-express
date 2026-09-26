// import { supabase } from "./client/supabase";

// export async function logActivity(
//     userId: string,
//     action: string,
//     module: string | '',
//     description: string
// ) {
//     return await supabase
//         .from("user_activity")
//         .insert({
//             user_id: userId,
//             action,
//             module,
//             description,
//             user_agent: navigator.userAgent,
//         });
// }