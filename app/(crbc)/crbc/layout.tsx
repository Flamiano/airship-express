import CrbcLayout from "../components/CrbcLayout"
import { protectRoute } from "../library/auth/protect";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
    await protectRoute("staff","profiles");

    return <CrbcLayout>{children}</CrbcLayout>
}
