import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import AnonIcon from '../svgs/spy-fill.svg'
import { useRouter } from 'next/router'
import cookie from 'cookie'
import { useMe, useMeRefresh } from './me'
import Image from 'react-bootstrap/Image'
import Link from 'next/link'
import { SSR } from '../lib/constants'
import { USER } from '../fragments/users'
import { useQuery } from '@apollo/client'

const AccountContext = createContext()

const b64Decode = str => Buffer.from(str, 'base64').toString('utf-8')

export const AccountProvider = ({ children }) => {
  const me = useMe()
  const [accounts, setAccounts] = useState([])
  const [isAnon, setIsAnon] = useState(true)

  useEffect(() => {
    try {
      const { multi_auth: multiAuthCookie } = cookie.parse(document.cookie)
      const accounts = multiAuthCookie
        ? JSON.parse(b64Decode(multiAuthCookie))
        : me ? [{ id: me.id, name: me.name, photoId: me.photoId }] : []
      setAccounts(accounts)
    } catch (err) {
      console.error('error parsing cookies:', err)
    }
  }, [])

  const addAccount = useCallback(user => {
    setAccounts(accounts => [...accounts, user])
  }, [setAccounts])

  const removeAccount = useCallback(userId => {
    setAccounts(accounts => accounts.filter(({ id }) => id !== userId))
  }, [setAccounts])

  useEffect(() => {
    // document not defined on server
    if (SSR) return
    const { 'multi_auth.user-id': multiAuthUserIdCookie } = cookie.parse(document.cookie)
    if (!multiAuthUserIdCookie) return false
    setIsAnon(multiAuthUserIdCookie === 'anonymous')
  }, [])

  return <AccountContext.Provider value={{ accounts, addAccount, removeAccount, isAnon, setIsAnon }}>{children}</AccountContext.Provider>
}

export const useAccounts = () => useContext(AccountContext)

const AnonAccount = ({ selected, onClick }) => {
  const { isAnon, setIsAnon } = useAccounts()
  const refreshMe = useMeRefresh()
  return (
    <div
      className='d-flex flex-column me-2 my-1 text-center'
    >
      <AnonIcon
        className='fill-muted'
        width='135' height='135' style={{ cursor: 'pointer' }} onClick={async () => {
          document.cookie = 'multi_auth.user-id=anonymous'
          // order is important to prevent flashes of no session
          setIsAnon(true)
          await refreshMe()
        }}
      />
      <div className='fst-italic'>anonymous</div>
      {isAnon && <div className='text-muted fst-italic'>selected</div>}
    </div>
  )
}

const Account = ({ account, className }) => {
  const me = useMe()
  const [name, setName] = useState(account.name)
  const [src, setSrc] = useState(account.photoId || '/dorian400.jpg')
  const refreshMe = useMeRefresh()
  const { setIsAnon } = useAccounts()
  useQuery(USER,
    {
      variables: { id: account.id },
      onCompleted ({ user: { name, photoId } }) {
        if (photoId) {
          const src = `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}/${photoId}`
          setSrc(src)
        }
        setName(name)
      }
    }
  )
  return (
    <div
      className='d-flex flex-column me-2 my-1 text-center'
    >
      <Image
        width='135' height='135' src={src} style={{ cursor: 'pointer' }} onClick={async () => {
          document.cookie = `multi_auth.user-id=${account.id}`
          await refreshMe()
          // order is important to prevent flashes of inconsistent data in switch account dialog
          setIsAnon(false)
        }}
      />
      <Link href={`/${account.name}`}>@{name}</Link>
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
