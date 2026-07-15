import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { guestLoginAction } from "@/lib/actions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>🧭 인턴 대시보드</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          계속하려면 로그인하세요.
        </p>
        <LoginForm />
        <div className="demo-creds">
          계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </div>

        <div className="login-divider">
          <span>또는</span>
        </div>
        <form action={guestLoginAction}>
          <button type="submit" className="btn btn-block">
            회원가입 없이 둘러보기
          </button>
        </form>
        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", margin: "8px 0 0" }}>
          로그인 없이 대시보드를 볼 수 있어요 · 보기 전용
        </p>
      </div>
    </div>
  );
}
