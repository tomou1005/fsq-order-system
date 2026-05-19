'use client'

import { useState } from 'react'
import { supabase } from './supabase'
import { useRouter } from 'next/navigation' // 👈 1. 引入跳轉工具

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter() // 👈 2. 初始化跳轉工具

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const email = employeeId.includes('@') 
  ? employeeId.trim() 
  : `${employeeId.trim()}@company.com`;
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('登入失敗：工號或密碼錯誤')
      setLoading(false)
    } else {
      // 👈 3. 登入成功後，直接跳轉到 dashboard 頁面
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white shadow-md rounded-lg w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">FSQ訂餐系統</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">員工工號</label>
            <input
              type="text"
              placeholder="請輸入工號(例: 104001)"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black outline-none focus:ring-2 focus:ring-blue-500"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">登入密碼</label>
            <input
              type="password"
              placeholder="預設密碼為 123456"
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition disabled:bg-gray-400"
          >
            {loading ? '驗證中...' : '登入系統'}
          </button>
        </form>
      </div>
    </div>
  )
}
