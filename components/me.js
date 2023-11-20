import React, { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { ME } from '../fragments/users'
import { SSR } from '../lib/constants'

export const MeContext = React.createContext({
  me: null
})

export function MeProvider ({ me, children }) {
  const { data, refetch } = useQuery(ME, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })
  // this makes sure that we always use the fetched data if it's null.
  // without this, we would always fallback to the `me` object
  // which was passed during page load which (visually) breaks switching to anon
  const futureMe = data?.me ?? (data?.me === null ? null : me)

  return (
    <MeContext.Provider value={{ me: futureMe, refetch }}>
      {children}
    </MeContext.Provider>
  )
}

export function useMe () {
  const { me } = useContext(MeContext)
  return me
}

export function useMeRefresh () {
  const { refetch } = useContext(MeContext)
  return refetch
}
