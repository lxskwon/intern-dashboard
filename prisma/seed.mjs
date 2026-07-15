import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The app is now self-service: people sign up themselves (with the shared
// SIGNUP_CODE) and create their own card. So "seeding" just means starting
// from a clean, empty roster.
async function main() {
  await prisma.assignment.deleteMany();
  await prisma.user.deleteMany();

  console.log("데이터베이스를 비웠습니다. 이제 아무 계정도 없습니다.");
  console.log("가입 페이지(/signup)에서 계정을 만드세요. 모두 인턴으로 등록됩니다.");
  console.log(`가입 액세스 코드: ${process.env.SIGNUP_CODE ?? "(SIGNUP_CODE 미설정)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
