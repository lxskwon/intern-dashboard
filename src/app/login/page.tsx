import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n-server";
import { LangToggle } from "@/components/LangToggle";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const t = await getT();

  return (
    <div className="login-wrap">
      <div className="login-lang">
        <LangToggle />
      </div>
      <div className="card login-card">
        <Image
          src="/sparklabs-logo.png"
          alt="SparkLabs"
          width={144}
          height={44}
          className="login-logo"
          priority
        />
        <h1>{t("펠로우십 대시보드")}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {t("계속하려면 로그인하세요.")}
        </p>
        <LoginForm />
        <div className="demo-creds">
          {t("계정이 없으신가요?")} <Link href="/signup">{t("회원가입")}</Link>
        </div>
      </div>
    </div>
  );
}
