import { useEffect, useRef, useState } from 'react'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { GamePage } from './pages/GamePage'
import { RulesPage } from './pages/RulesPage'

function currentPage() {
  const hash = window.location.hash
  return hash === '#/game' ? 'game' : hash === '#/rules' ? 'rules' : 'home'
}

export function App() {
  const [page, setPage] = useState(currentPage)
  const previousPage = useRef(page)
  useEffect(() => {
    const navigate = () => setPage(currentPage())
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    document.title = `Least Count — ${page === 'game' ? 'Table preview' : page === 'rules' ? 'Rulebook coming soon' : 'Take a seat.'}`
    if (previousPage.current !== page) {
      document.getElementById('main')?.focus()
      window.scrollTo(0, 0)
      previousPage.current = page
    }
  }, [page])
  return <Layout page={page}>{page === 'game' ? <GamePage /> : page === 'rules' ? <RulesPage /> : <HomePage />}</Layout>
}
