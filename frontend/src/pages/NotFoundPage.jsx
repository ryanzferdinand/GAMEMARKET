import React from 'react'
import { Link } from 'react-router-dom'
import { MdArrowForward } from 'react-icons/md'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="text-center animate-fade-up max-w-sm">
        <p className="text-[80px] font-bold tracking-tighter text-neutral-200 dark:text-neutral-800 leading-none mb-4">
          404
        </p>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm text-neutral-400 mb-6">
          Halaman yang Anda cari tidak ada atau sudah dipindahkan.
        </p>
        <Link to="/" className="btn-primary gap-2 py-2.5 px-6">
          Kembali ke Beranda
          <MdArrowForward size={16} />
        </Link>
      </div>
    </div>
  )
}
