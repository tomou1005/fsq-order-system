'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  // --- 1. 狀態儲存 ---
  const [userProfile, setUserProfile] = useState<any>(null)
  const [menu, setMenu] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'))
  const router = useRouter()

  // 彈窗控制開關
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isAdminOrderModalOpen, setIsAdminOrderModalOpen] = useState(false)
  
  // 資料儲存
  const [newMenu, setNewMenu] = useState({ dish_a: '', dish_b: '', dish_veggie: '' })
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [userCurrentOrder, setUserCurrentOrder] = useState<string | null>(null)

  // --- 2. 初始化與資料抓取 ---
  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // 抓個人資料
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setUserProfile(profile)

    // 抓取選定日期的菜單
    const { data: menuData } = await supabase.from('menus').select('*').eq('date', selectedDate).single()
    setMenu(menuData)
    if (menuData) {
      setNewMenu({ dish_a: menuData.dish_a, dish_b: menuData.dish_b, dish_veggie: menuData.dish_veggie })
    } else {
      setNewMenu({ dish_a: '', dish_b: '', dish_veggie: '' })
    }

    // 抓取個人當日訂單狀態
    const { data: myOrder } = await supabase.from('orders')
      .select('meal_type')
      .eq('order_date', selectedDate)
      .eq('user_id', user.id)
      .maybeSingle()
    setUserCurrentOrder(myOrder?.meal_type || null)

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  // --- 3. 功能函式 ---

  // A. 單日訂餐
  const handleOrderAction = async (userId: string, type: string, isFromAdmin = false) => {
    const { error } = await supabase.from('orders').upsert(
      { user_id: userId, order_date: selectedDate, meal_type: type },
      { onConflict: 'user_id,order_date' }
    )
    if (error) {
      alert('操作失敗')
    } else {
      if (isFromAdmin) {
        alert('代訂成功')
        fetchAllEmployees() 
      } else {
        alert(`成功預訂 ${selectedDate} 的 ${type}！`)
        fetchData()
      }
    }
  }

  // B. 快速訂一週
  const handleWeeklyOrder = async (type: string) => {
    const confirmAction = confirm(`確定要預訂未來 7 天內所有已公佈菜單的 ${type} 嗎？`);
    if (!confirmAction) return;

    const datesToBook = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      datesToBook.push(d.toLocaleDateString('en-CA'));
    }

    const { data: availableMenus } = await supabase.from('menus').select('date').in('date', datesToBook);

    if (!availableMenus || availableMenus.length === 0) {
      alert('未來一週目前都沒有發布菜單，無法預訂。');
      return;
    }

    const ordersToInsert = availableMenus.map(m => ({
      user_id: userProfile.id,
      order_date: m.date,
      meal_type: type
    }));

    const { error } = await supabase.from('orders').upsert(ordersToInsert, { onConflict: 'user_id,order_date' });

    if (error) alert('批次預訂失敗');
    else {
      alert(`完成！成功預訂了 ${availableMenus.length} 天的餐點。`);
      fetchData();
    }
  }

  // C. 管理員：發布菜單
  const handleSubmitMenu = async () => {
    const { error } = await supabase.from('menus').upsert({
      date: selectedDate,
      ...newMenu
    })
    if (error) alert('發布失敗')
    else { alert(`${selectedDate} 菜單已更新！`); setIsMenuModalOpen(false); fetchData() }
  }

  // D. 管理員：統計訂單
  const fetchAllOrders = async () => {
    const { data: orderData } = await supabase.from('orders').select('meal_type, user_id').eq('order_date', selectedDate)
    if (!orderData || orderData.length === 0) {
        setAllOrders([]); setIsOrderModalOpen(true); return;
    }
    const userIds = orderData.map(o => o.user_id)
    const { data: profileData } = await supabase.from('profiles').select('id, full_name, department').in('id', userIds)
    const combined = orderData.map(order => ({
      ...order,
      profiles: profileData?.find(p => p.id === order.user_id)
    }))
    setAllOrders(combined); setIsOrderModalOpen(true)
  }

  // E. 管理員：代訂名單
  const fetchAllEmployees = async () => {
    const { data: empData } = await supabase.from('profiles').select('*').order('employee_id')
    const { data: orderData } = await supabase.from('orders').select('user_id, meal_type').eq('order_date', selectedDate)
    if (empData) {
      const empsWithStatus = empData.map(emp => ({
        ...emp,
        currentOrder: orderData?.find(o => o.user_id === emp.id)
      }))
      setAllEmployees(empsWithStatus); setIsAdminOrderModalOpen(true)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut(); router.push('/')
  }

  if (loading) return <div className="p-10 text-center">讀取中...</div>

  // --- 4. 畫面結構 ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 text-black">
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm border">
        <div>
          <h1 className="text-xl font-bold text-blue-600">FSQ 訂餐系統</h1>
          <p className="text-sm text-gray-500">你好, {userProfile?.full_name} ({userProfile?.role === 'admin' ? '管理員' : '同仁'})</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-500 border border-red-500 px-3 py-1 rounded">登出</button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* 菜單區 */}
        <div className="bg-white p-6 rounded-xl shadow-md border">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-lg font-bold">🍱 菜單瀏覽與訂購</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">日期:</span>
              <input type="date" className="border rounded p-1" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          </div>

          {menu ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'A', name: 'A 餐', dish: menu.dish_a, color: 'blue' },
                  { id: 'B', name: 'B 餐', dish: menu.dish_b, color: 'green' },
                  { id: 'Veggie', name: '素食', dish: menu.dish_veggie, color: 'orange' }
                ].map((item) => (
                  <div key={item.id} className={`p-4 border rounded-lg bg-${item.color}-50`}>
                    <p className={`font-bold text-${item.color}-800`}>{item.name}</p>
                    <p className="min-h-[3rem] text-sm my-2">{item.dish}</p>
                    <button 
                      onClick={() => handleOrderAction(userProfile.id, item.id)}
                      className={`mt-2 w-full py-2 rounded text-white font-bold ${userCurrentOrder === item.id ? 'bg-gray-400' : `bg-${item.color}-500`}`}
                      disabled={userCurrentOrder === item.id}
                    >
                      {userCurrentOrder === item.id ? '已選購' : '點我預訂'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-dashed flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="font-bold text-gray-700">🚀 懶人包：快速訂一週</h3>
                  <p className="text-xs text-gray-400">自動預訂未來 7 天內「已公布菜單」的日子</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleWeeklyOrder('A')} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">通通 A 餐</button>
                  <button onClick={() => handleWeeklyOrder('B')} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold">通通 B 餐</button>
                  <button onClick={() => handleWeeklyOrder('Veggie')} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">通通素食</button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-gray-400">
               {selectedDate} 尚未公佈菜單
               {userProfile?.role === 'admin' && <p className="mt-2"><button onClick={() => setIsMenuModalOpen(true)} className="text-blue-500 underline font-bold">立即發布</button></p>}
            </div>
          )}
        </div>

        {/* 管理員控制台 */}
        {userProfile?.role === 'admin' && (
          <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 shadow-md">
            <h2 className="text-lg font-bold mb-4 text-yellow-800">⚙ 管理員控制台 ({selectedDate})</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setIsMenuModalOpen(true)} className="bg-yellow-600 text-white px-6 py-2 rounded font-bold">編輯菜單</button>
              <button onClick={fetchAllOrders} className="bg-white border border-yellow-600 text-yellow-600 px-6 py-2 rounded font-bold">查看統計</button>
              <button onClick={fetchAllEmployees} className="bg-white border border-yellow-600 text-yellow-600 px-6 py-2 rounded font-bold">管理者代訂</button>
            </div>
          </div>
        )}
      </div>

      {/* --- 5. 彈窗區域 (Modals) --- */}

      {isMenuModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md border shadow-2xl">
            <h3 className="font-bold mb-4 text-xl border-b pb-2">編輯 {selectedDate} 菜單</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500">A 餐內容</label>
              <input type="text" className="w-full border p-2 rounded" value={newMenu.dish_a} onChange={e => setNewMenu({...newMenu, dish_a: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-500">B 餐內容</label>
              <input type="text" className="w-full border p-2 rounded" value={newMenu.dish_b} onChange={e => setNewMenu({...newMenu, dish_b: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-500">素食內容</label>
              <input type="text" className="w-full border p-2 rounded" value={newMenu.dish_veggie} onChange={e => setNewMenu({...newMenu, dish_veggie: e.target.value})} /></div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setIsMenuModalOpen(false)} className="px-4 py-2 text-gray-500">取消</button>
                <button onClick={handleSubmitMenu} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">儲存並發布</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto border shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-xl">{selectedDate} 訂單統計 ({allOrders.length} 份)</h3>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-2xl">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
               <div className="bg-blue-50 p-3 rounded-lg border border-blue-200"><p className="text-xs text-blue-600 font-bold">A餐</p><p className="text-xl font-bold">{allOrders.filter(o => o.meal_type === 'A').length}</p></div>
               <div className="bg-green-50 p-3 rounded-lg border border-green-200"><p className="text-xs text-green-600 font-bold">B餐</p><p className="text-xl font-bold">{allOrders.filter(o => o.meal_type === 'B').length}</p></div>
               <div className="bg-orange-50 p-3 rounded-lg border border-orange-200"><p className="text-xs text-orange-600 font-bold">素食</p><p className="text-xl font-bold">{allOrders.filter(o => o.meal_type === 'Veggie').length}</p></div>
            </div>
            <table className="w-full text-left border">
              <thead className="bg-gray-100"><tr><th className="p-2 border">姓名</th><th className="p-2 border">部門</th><th className="p-2 border">餐點</th></tr></thead>
              <tbody>
                {allOrders.length > 0 ? allOrders.map((o, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50"><td className="p-2 border">{o.profiles?.full_name}</td><td className="p-2 border">{o.profiles?.department}</td><td className="p-2 border font-bold">{o.meal_type}</td></tr>
                )) : <tr><td colSpan={3} className="p-10 text-center text-gray-400">當日尚無訂單</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdminOrderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto border shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-xl">{selectedDate} 代訂名單</h3>
              <button onClick={() => setIsAdminOrderModalOpen(false)} className="text-2xl">✕</button>
            </div>
            <table className="w-full text-left border">
              <thead className="bg-gray-100"><tr><th className="p-2 border">工號/姓名</th><th className="p-2 border">目前訂單</th><th className="p-2 border">操作</th></tr></thead>
              <tbody>
                {allEmployees.map((emp) => (
                  <tr key={emp.id} className={`border-b ${emp.currentOrder ? 'bg-green-50' : ''}`}>
                    <td className="p-2 border">{emp.employee_id} - {emp.full_name}</td>
                    <td className="p-2 border font-bold text-blue-600">{emp.currentOrder ? `✅ ${emp.currentOrder.meal_type}` : '❌ 未訂'}</td>
                    <td className="p-2 border flex gap-1">
                      {['A', 'B', 'Veggie'].map(type => (
                        <button key={type} onClick={() => handleOrderAction(emp.id, type, true)} className="text-xs border px-2 py-1 rounded bg-white hover:bg-gray-200">代訂{type}</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
