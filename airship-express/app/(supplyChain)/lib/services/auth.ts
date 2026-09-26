
// import { supabase } from "./client/supabase";

// //testing if kanya kanyang login
// export async function completeLogin(
//     userId: string,
//     sessionId: string,
// ) {
//     await supabase
//         .from("users")
//         .update({
//             session_id: sessionId,
//             last_login: new Date().toISOString(),
//         })
//         .eq("id", userId);

//     localStorage.setItem("session_id", sessionId);
// }
