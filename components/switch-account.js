import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import AnonIcon from '../svgs/spy-fill.svg'
import { useRouter } from 'next/router'
import cookie from 'cookie'
import { useMe, useMeRefresh } from './me'
import Image from 'react-bootstrap/Image'
import Link from 'next/link'

const AccountContext = createContext()

export const AccountProvider = ({ children }) => {
  const me = useMe()
  const [accounts, setAccounts] = useState()

  useEffect(() => {
    const { multi_auth: multiAuthCookie } = cookie.parse(document.cookie)
    const accounts = multiAuthCookie
      ? JSON.parse(multiAuthCookie)
      : me ? [{ id: me.id, name: me.name, photoId: me.photoId }] : []
    setAccounts(accounts)
  }, [])

  const addAccount = useCallback(user => {
    setAccounts(accounts => [...accounts, user])
  }, [setAccounts])

  const removeAccount = useCallback(userId => {
    setAccounts(accounts => accounts.filter(({ id }) => id !== userId))
  }, [setAccounts])

  return <AccountContext.Provider value={{ accounts, addAccount, removeAccount }}>{children}</AccountContext.Provider>
}

const useAccounts = () => useContext(AccountContext)

const AnonAccount = () => {
  const me = useMe()
  const refreshMe = useMeRefresh()
  return (
    <div
      className='d-flex flex-column me-2 my-1 text-center'
    >
      <AnonIcon
        className='fill-muted'
        width='135' height='135' style={{ cursor: 'pointer' }} onClick={() => {
          document.cookie = 'multi_auth.user-id=anonymous'
          refreshMe()
        }}
      />
      <div className='fst-italic'>anonymous</div>
      {!me && <div className='text-muted fst-italic'>selected</div>}
    </div>
  )
}

const Account = ({ account, className }) => {
  const me = useMe()
  const refreshMe = useMeRefresh()
  const src = account.photoId ? `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}/${account.photoId}` : '/dorian400.jpg'
  return (
    <div
      className='d-flex flex-column me-2 my-1 text-center'
    >
      <Image
        width='135' height='135' src={src} style={{ cursor: 'pointer' }} onClick={() => {
          document.cookie = `multi_auth.user-id=${account.id}`
          refreshMe()
        }}
      />
      <Link href={`/${account.name}`}>@{account.name}</Link>
      {Number(me?.id) === Number(account.id) && <div className='text-muted fst-italic'>selected</div>}
    </div>
  )
}

const AddAccount = () => {
  const router = useRouter()
  return (
    <div className='d-flex flex-column me-2 my-1 text-center'>
      <Image
        width='135' height='135' src='https://imgs.search.brave.com/t8qv-83e1m_kaajLJoJ0GNID5ch0WvBGmy7Pkyr4kQY/rs:fit:860:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvY29tbW9ucy84/Lzg5L1BvcnRyYWl0/X1BsYWNlaG9sZGVy/LnBuZw' style={{ cursor: 'pointer' }} onClick={() => {
          router.push({
            pathname: '/login',
            query: { callbackUrl: window.location.origin + router.asPath, multiAuth: true }
          })
        }}
      />
      <div className='fst-italic'>+ add account</div>
    </div>
  )
}

export default function SwitchAccountDialog () {
  const { accounts } = useAccounts()
  return (
    <>
      <h3>Switch Account</h3>
      <div className='my-2'>
        <div className='d-flex flex-row flex-wrap'>
          <AnonAccount />
          {
            accounts.map((account) => <Account key={account.id} account={account} />)
          }
          <AddAccount />
        </div>
      </div>

    </>
  )
}
