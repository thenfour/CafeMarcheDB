import { describe, expect, it } from "vitest";
import { Login, Signup } from "src/auth/schemas";
import { xUser } from "src/core/db3/shared/schema/user";

describe("authentication form validation", () => {
    it("rejects missing login credentials", () => {
        const result = Login.safeParse({ email: "", password: "" });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.flatten().fieldErrors.email).toBeDefined();
        expect(result.error.flatten().fieldErrors.password).toEqual(["Password is required"]);
    });

    it("rejects invalid signup fields", () => {
        const result = Signup.safeParse({ name: "   ", email: "invalid", password: "short" });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.flatten().fieldErrors.name).toEqual(["Name is required"]);
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
        expect(result.error.flatten().fieldErrors.password).toBeDefined();
    });

    it("normalizes valid signup fields before submission", () => {
        expect(Signup.parse({
            name: "  Example User  ",
            email: "  USER@EXAMPLE.COM  ",
            password: "password123",
        })).toMatchObject({
            name: "Example User",
            email: "user@example.com",
        });
    });
});

describe("user profile validation", () => {
    it("rejects a blank name through the editable user schema", () => {
        const result = xUser.ValidateAndComputeDiff(
            { name: "Example User" },
            { name: "   " },
            "update",
        );

        expect(result.success).toBe(false);
        expect(result.getErrorForField("name")).toBe("minimum length not satisfied");
    });
});