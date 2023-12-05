import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import cookie from 'cookie'
import { useMe } from './me'
import { ANON_USER_ID, SSR } from '../lib/constants'
import { USER } from '../fragments/users'
import { useQuery } from '@apollo/client'
import { UserListRow } from './user-list'

const AccountContext = createContext()

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')

export const AccountProvider = ({ children }) => {
  const { me } = useMe()
  const [accounts, setAccounts] = useState([])
  const [isAnon, setIsAnon] = useState(true)

  const updateAccountsFromCookie = useCallback(() => {
    try {
      const { multi_auth: multiAuthCookie } = cookie.parse(document.cookie)
      const accounts = multiAuthCookie
        ? JSON.parse(b64Decode(multiAuthCookie))
        : me ? [{ id: me.id, name: me.name, photoId: me.photoId }] : []
      setAccounts(accounts)
    } catch (err) {
      console.error('error parsing cookies:', err)
    }
  }, [setAccounts])

  useEffect(() => {
    updateAccountsFromCookie()
  }, [])

  const addAccount = useCallback(user => {
    setAccounts(accounts => [...accounts, user])
  }, [setAccounts])

  const removeAccount = useCallback(userId => {
    setAccounts(accounts => accounts.filter(({ id }) => id !== userId))
  }, [setAccounts])

  const multiAuthSignout = useCallback(async () => {
    // document.cookie = 'multi_auth.user-id='
    // switch to next available account
    const { status } = await fetch('/api/signout', { credentials: 'include' })
    if (status === 201) updateAccountsFromCookie()
    return status
  }, [updateAccountsFromCookie])

  useEffect(() => {
    // document not defined on server
    if (SSR) return
    const { 'multi_auth.user-id': multiAuthUserIdCookie } = cookie.parse(document.cookie)
    setIsAnon(multiAuthUserIdCookie === 'anonymous')
  }, [])

  return <AccountContext.Provider value={{ accounts, addAccount, removeAccount, isAnon, setIsAnon, multiAuthSignout }}>{children}</AccountContext.Provider>
}

export const useAccounts = () => useContext(AccountContext)

const AccountListRow = ({ account, ...props }) => {
  const { isAnon, setIsAnon } = useAccounts()
  const { me, refreshMe } = useMe()
  const anonRow = account.id === ANON_USER_ID
  const selected = (isAnon && anonRow) || Number(me?.id) === Number(account.id)

  // fetch updated names and photo ids since they might have changed since we were issued the JWTs
  const [name, setName] = useState(account.name)
  const [photoId, setPhotoId] = useState(account.photoId)
  useQuery(USER,
    {
      variables: { id: account.id },
      onCompleted ({ user: { name, photoId } }) {
        if (photoId) setPhotoId(photoId)
        if (name) setName(name)
      }
    }
  )

  const onClick = async (e) => {
    // prevent navigation
    e.preventDefault()
    document.cookie = `multi_auth.user-id=${anonRow ? 'anonymous' : account.id}; Path=/; Secure`
    if (anonRow) {
      // order is important to prevent flashes of no session
      setIsAnon(true)
      await refreshMe()
    } else {
      await refreshMe()
      // order is important to prevent flashes of inconsistent data in switch account dialog
      setIsAnon(account.id === ANON_USER_ID)
    }
  }
  // can't show hat since we don't have access to the streak from the data available in the cookies
  return (
    <div className='d-flex flex-row'>
      <UserListRow user={{ ...account, photoId, name }} className='d-flex align-items-center me-2' {...props} onNymClick={onClick} />
      {selected && <div className='text-muted fst-italic text-muted'>selected</div>}
    </div>
  )
}

export default function SwitchAccountList () {
  const { accounts } = useAccounts()
  const router = useRouter()
  const addAccount = () => {
    router.push({
      pathname: '/login',
      query: { callbackUrl: window.location.origin + router.asPath, multiAuth: true }
    })
  }
  return (
    <>
      <div className='my-2'>
        <div className='d-flex flex-column flex-wrap'>

          <AccountListRow account={{ id: ANON_USER_ID, name: 'anon' }} showHat={false} />
          {

            accounts.map((account) => <AccountListRow key={account.id} account={account} showHat={false} />)
          }
          <div style={{ cursor: 'pointer' }} onClick={addAccount}>+ add account</div>
        </div>
      </div>
    </>
  )
}
