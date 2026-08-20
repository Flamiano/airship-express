"use server"


import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../library/supabase/server";


export const customerLogin = async (formData: FormData) => {
        const supabase = await createClient();

        const data = {
            email: formData.get("email") as string,
            password: formData.get("password") as string
        }
     
        const {error} = await supabase.auth.signInWithPassword(data);
        if(error){ 
            return { error: error.message };
        }


        const { data: profile } = await supabase.from("customers")
                                                .select("role")
                                                .eq("email", data.email)
                                                .single();


        if (!profile || profile.role !== "customer") {
        await supabase.auth.signOut();
        return { error: "Invalid credentials" };
    }


        revalidatePath("/", "layout");
        redirect("/customer/dashboard");
}
    
export const customerServiceLogin = async (formData: FormData) => {
        const supabase = await createClient();

        const data = {
            email: formData.get("email") as string,
            password: formData.get("password") as string
        }
     
        const {error} = await supabase.auth.signInWithPassword(data);
        if(error){ 
            return { error: error.message };
        }


        const { data: profile } = await supabase.from("profiles")
                                                .select("role")
                                                .eq("email", data.email)
                                                .single();


        if (!profile || profile.role !== "staff") {
        await supabase.auth.signOut();
        return { error: "Invalid credentials" };
    }


        revalidatePath("/", "layout");
        redirect("/crbc/dashboard");
}

export const signUp = async (formData: FormData) => {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
            },
        },
    });

    if (error) {
        return { error: error.message };
    }

    if (data.user) {
        const { error: profileError } = await supabase
            .from("customers")
            .insert({
                id: data.user.id,
                email: email,
                full_name: name,
                role: "customer",
                source: "online"
            });

        if (profileError) {
            console.log(profileError);
            return { error: profileError.message };
        }
    }

    revalidatePath("/", "layout");
    redirect("/customer/dashboard");
};

export const logout = async () => {
        const supabase = await createClient();
        await supabase.auth.signOut();
        revalidatePath("/", "layout");
        redirect("/login")
}

export const customerServiceLogout = async () => {
        const supabase = await createClient();
        await supabase.auth.signOut();
        revalidatePath("/", "layout");
        redirect("/crbcAuth/login")
}