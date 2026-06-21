import React, { useEffect, useState } from 'react'
import api from '../../lib/api'

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/marketplace-admin/audit-logs')
      .then(({ data }) => setLogs(data.logs))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Akses chat & tindakan moderator</p>
      </div>

      <div className="card divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <div className="p-6 skeleton h-20" />
        ) : logs.length ? logs.map((log) => (
          <div key={log._id} className="p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{log.action}</span>
              <span className="text-xs text-neutral-400">{new Date(log.createdAt).toLocaleString('id-ID')}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {log.actor?.username} · {log.targetType} · {log.reason}
            </p>
          </div>
        )) : (
          <p className="p-6 text-sm text-neutral-400 text-center">Belum ada log</p>
        )}
      </div>
    </div>
  )
}
