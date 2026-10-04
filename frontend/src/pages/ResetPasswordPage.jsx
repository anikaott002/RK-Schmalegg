import React, {
  useEffect,
  useState
} from 'react'

import {
  useNavigate
} from 'react-router-dom'

import {
  clearPasswordRecoverySession,
  getPasswordRecoverySession,
  updatePasswordFromRecovery,
} from '../authService'

import '../UserLogin.css'


const LOGO_URL =
  'https://tse4.mm.bing.net/th/id/OIP.UORK-u3V7UVpyTeEcb0y_QHaHa?rs=1&pid=ImgDetMain&o=7&rm=3'


const ResetPasswordPage = () => {
  const navigate =
    useNavigate()

  const [checking, setChecking] =
    useState(true)

  const [validSession, setValidSession] =
    useState(false)

  const [password, setPassword] =
    useState('')

  const [
    passwordRepeat,
    setPasswordRepeat
  ] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')


  // === PASSWORD RESET START: CHECK RECOVERY LINK ===
  useEffect(() => {
    let active = true

    const checkRecoverySession =
      async () => {
        try {
          const session =
            await getPasswordRecoverySession()

          if (!active) {
            return
          }

          if (!session) {
            setError(
              'Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.'
            )

            return
          }

          setValidSession(true)
        } catch (requestError) {
          if (!active) {
            return
          }

          setError(
            requestError.message ||
            'Der Link konnte nicht geprüft werden.'
          )
        } finally {
          if (active) {
            setChecking(false)
          }
        }
      }

    checkRecoverySession()

    return () => {
      active = false
    }
  }, [])
  // === PASSWORD RESET END: CHECK RECOVERY LINK ===


  const handleSubmit =
    async event => {
      event.preventDefault()

      setError('')

      if (
        password.length < 12
      ) {
        setError(
          'Das Passwort muss mindestens 12 Zeichen lang sein.'
        )

        return
      }

      if (
        password !== passwordRepeat
      ) {
        setError(
          'Die Passwörter stimmen nicht überein.'
        )

        return
      }

      setLoading(true)

      try {
        await updatePasswordFromRecovery(
          password
        )

        await clearPasswordRecoverySession()

        navigate(
          '/login?reset=success',
          {
            replace: true,
          }
        )
      } catch (requestError) {
        setError(
          requestError.message ||
          'Das Passwort konnte nicht geändert werden.'
        )
      } finally {
        setLoading(false)
      }
    }


  if (checking) {
    return (
      <div className="user-login-container">
        <div className="login-box">
          <div className="login-header">
            <img
              src={LOGO_URL}
              alt="RK Schmalegg Logo"
              className="header-logo"
            />

            <h2>
              Passwort zurücksetzen
            </h2>
          </div>

          <p className="login-subtitle">
            Link wird geprüft...
          </p>
        </div>
      </div>
    )
  }


  return (
    <div className="user-login-container">
      <div className="login-box">

        <div className="login-header">
          <img
            src={LOGO_URL}
            alt="RK Schmalegg Logo"
            className="header-logo"
          />

          <h2>
            Passwort zurücksetzen
          </h2>
        </div>


        {error && (
          <div
            className="error-message"
            role="alert"
          >
            {error}
          </div>
        )}


        {validSession && (
          <>
            <p className="login-subtitle">
              Bitte legen Sie ein neues Passwort fest.
            </p>

            <form
              onSubmit={handleSubmit}
              className="login-form"
            >

              <div className="form-group">
                <label htmlFor="new-password">
                  Neues Passwort:
                </label>

                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={
                    event =>
                      setPassword(
                        event.target.value
                      )
                  }
                  placeholder="Mindestens 12 Zeichen"
                  className="login-input"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>


              <div className="form-group">
                <label htmlFor="repeat-password">
                  Passwort wiederholen:
                </label>

                <input
                  id="repeat-password"
                  type="password"
                  value={passwordRepeat}
                  onChange={
                    event =>
                      setPasswordRepeat(
                        event.target.value
                      )
                  }
                  placeholder="Passwort wiederholen"
                  className="login-input"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>


              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {
                  loading
                    ? 'Bitte warten...'
                    : 'Neues Passwort speichern'
                }
              </button>

            </form>
          </>
        )}


        {!validSession && (
          <button
            type="button"
            className="login-mode-button"
            onClick={
              () =>
                navigate(
                  '/login',
                  {
                    replace: true,
                  }
                )
            }
          >
            Zurück zur Anmeldung
          </button>
        )}

      </div>
    </div>
  )
}


export default ResetPasswordPage