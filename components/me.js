import React, { useContext } from 'react'
import { useQuery } from '@apollo/client'
import { ME } from '../fragments/users'
import { SSR } from '../lib/constants'

export const MeContext = React.createContext({
  me: null
})

export function MeProvider ({ me, children }) {
  const { data, refetch } = useQuery(ME, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })

  return (
    <MeContext.Provider value={{ me: data?.me || me, refetch }}>
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
