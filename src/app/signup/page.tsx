import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n-server";
import { LangToggle } from "@/components/LangToggle";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
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
          {t("계정을 만들고 나만의 카드를 등록하세요.")}
        </p>
        <SignupForm />
        <div className="demo-creds">
          {t("이미 계정이 있으신가요?")} <Link href="/login">{t("로그인")}</Link>
        </div>
      </div>
    </div>
  );
}
