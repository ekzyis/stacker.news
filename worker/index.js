import PgBoss from 'pg-boss'
import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { checkInvoice, checkWithdrawal, autoDropBolt11s } from './wallet.js'
import { repin } from './repin.js'
import { trust } from './trust.js'
import { auction } from './auction.js'
import { earn } from './earn.js'
import apolloClient from '@apollo/client'
import { indexItem, indexAllItems } from './search.js'
import { timestampItem } from './ots.js'
import { computeStreaks, checkStreak } from './streak.js'
import { nip57 } from './nostr.js'
import fetch from 'cross-fetch'
import { authenticatedLndGrpc, subscribeToInvoices, subscribeToPayments } from 'ln-service'
import { views, rankViews } from './views.js'
import { imgproxy } from './imgproxy.js'
import { deleteItem } from './ephemeralItems.js'
import { deleteUnusedImages } from './deleteUnusedImages.js'
import { territoryBilling } from './territory.js'
import { ofac } from './ofac.js'

const { loadEnvConfig } = nextEnv
const { ApolloClient, HttpLink, InMemoryCache } = apolloClient

loadEnvConfig('..')

async function work () {
  const boss = new PgBoss(process.env.DATABASE_URL)
  const models = new PrismaClient()

  const apollo = new ApolloClient({
    link: new HttpLink({
      uri: `${process.env.SELF_URL}/api/graphql`,
      fetch
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache'
      },
      query: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache'
      }
    }
  })

  const { lnd } = authenticatedLndGrpc({
    cert: process.env.LND_CERT,
    macaroon: process.env.LND_MACAROON,
    socket: process.env.LND_SOCKET
  })

  const args = { boss, models, apollo, lnd }

  boss.on('error', error => console.error(error))

  function jobWrapper (fn) {
    return async function (job) {
      console.log(`running ${job.name} with args`, job.data)
      try {
        await fn({ ...job, ...args })
      } catch (error) {
        console.error(`error running ${job.name}`, error)
        throw error
      }
      console.log(`finished ${job.name}`)
    }
  }

  async function subWrapper (sub, ...eventFns) {
    for (let i = 0; i < eventFns.length; i += 2) {
      const [event, fn] = [eventFns[i], eventFns[i + 1]]
      sub.on(event, async (...args) => {
        console.log(`event ${event} triggered with args`, args)
        try {
          await fn(...args)
        } catch (error) {
          console.error(`error running ${event}`, error)
          return
        }
        console.log(`finished ${event}`)
      })
    }
    sub.on('error', (err) => {
      console.error(err)
      // LND connection lost
      // see https://www.npmjs.com/package/ln-service#subscriptions
      sub.removeAllListeners()
    })
  }

  await boss.start()

  const [lastConfirmed] = await models.$queryRaw`SELECT "confirmedIndex" FROM "Invoice" ORDER BY "confirmedIndex" DESC NULLS LAST LIMIT 1`
  subWrapper(subscribeToInvoices({ lnd, confirmed_after: lastConfirmed?.confirmedIndex }),
    'invoice_updated', (inv) => checkInvoice({ data: { hash: inv.id, sub: true }, ...args }))
  await boss.work('checkInvoice', jobWrapper(checkInvoice))

  subWrapper(subscribeToPayments({ lnd }),
    'confirmed', (inv) => checkWithdrawal({ data: { hash: inv.id, sub: true }, ...args }),
    'failed', (inv) => checkWithdrawal({ data: { hash: inv.id, sub: true } }, ...args),
    'paying', (inv) => {} // ignore payment attempts
  )
  await boss.work('checkWithdrawal', jobWrapper(checkWithdrawal))

  // queue status check of all pending withdrawals since they might have been paid by LND while worker was down
  await models.$queryRaw`
    INSERT INTO pgboss.job (name, data, retrylimit, retrybackoff, startafter)
    SELECT 'checkWithdrawal', json_build_object('id', w.id, 'hash', w.hash), 21, true, now() + interval '10 seconds'
    FROM "Withdrawl" w WHERE w.status IS NULL`

  await boss.work('autoDropBolt11s', jobWrapper(autoDropBolt11s))
  await boss.work('repin-*', jobWrapper(repin))
  await boss.work('trust', jobWrapper(trust))
  await boss.work('timestampItem', jobWrapper(timestampItem))
  await boss.work('indexItem', jobWrapper(indexItem))
  await boss.work('indexAllItems', jobWrapper(indexAllItems))
  await boss.work('auction', jobWrapper(auction))
  await boss.work('earn', jobWrapper(earn))
  await boss.work('streak', jobWrapper(computeStreaks))
  await boss.work('checkStreak', jobWrapper(checkStreak))
  await boss.work('nip57', jobWrapper(nip57))
  await boss.work('views', jobWrapper(views))
  await boss.work('rankViews', jobWrapper(rankViews))
  await boss.work('imgproxy', jobWrapper(imgproxy))
  await boss.work('deleteItem', jobWrapper(deleteItem))
  await boss.work('deleteUnusedImages', jobWrapper(deleteUnusedImages))
  await boss.work('territoryBilling', jobWrapper(territoryBilling))
  await boss.work('ofac', jobWrapper(ofac))

  console.log('working jobs')
}

work()
