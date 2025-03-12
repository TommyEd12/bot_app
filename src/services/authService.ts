import Elysia from "elysia"

export const AuthService = new Elysia({ name: 'Service.Auth' })
    .derive({ as: 'scoped' }, ({ cookie: { auth } }) => ({
    	// This is equivalent to dependency injection
        Auth: {
            user: auth.value
        }
    }))
    .macro(({ onBeforeHandle }) => ({
     	// This is declaring a sFervice method
        isSignIn(value: boolean) {
            onBeforeHandle(({ Auth, error }) => {
                console.log("Here")
                if (!Auth?.user || !Auth.user) return error(401)
            })
        }
    }))