import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>🧭 인턴 대시보드</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          계정을 만들고 나만의 카드를 등록하세요.
        </p>
        <SignupForm />
        <div className="demo-creds">
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
