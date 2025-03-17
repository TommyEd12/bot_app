import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { db } from "../../db";
import { usersTable } from "../../db/schema";
import { eq } from "drizzle-orm";
import { takeUniqueOrThrow } from "../../utils";
import { AuthService } from "../../services/authService";

export const userRoutes = new Elysia({ prefix: "/user" })
  .use(AuthService)
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET!,
    })
  )
  .get("/sign-out", ({ cookie: { auth } }) => {
    auth.remove();
    return {
      success: true,
      message: "Signed out",
    };
  })
  .get(
    "/profile",
    ({ set }) => {
      set.status = 200;
      return true;
    },
    { isSignIn: true }
  )
  .get("/addAdmin", async ({ set }) => {
    await db
      .insert(usersTable)
      .values({ userName: "YeniseyAdmin", password: "yenisey1234" });
    set.status = 200;
    return true;
  })
  .post(
    "/login",
    async ({ jwt, cookie: { auth }, body }) => {
      const { userName, password } = body;
      const user = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.userName, userName))
        .then(takeUniqueOrThrow);
      if (!user) {
        throw new Error("Пользователь не найден");
      }
      const bcryptHash = await Bun.password.hash(password, {
        algorithm: "bcrypt",
      });
      const isCorrectPassword = await Bun.password.verify(
        password,
        user.password,
        "bcrypt"
      );
      if (!isCorrectPassword) {
        throw new Error("Неверный пароль");
      }
      auth.set({
        value: await jwt.sign({
          userName: user.userName,
        }),
        httpOnly: true,
        domain: process.env.CORS_ORIGIN,
        maxAge: 7 * 86400,
        path: "/",
      });

      return {
        success: true,
        data: auth,
        message: "Account login successfully",
      };
    },
    {
      body: t.Object({
        userName: t.String(),
        password: t.String({ minLength: 8 }),
      }),
    }
  );
