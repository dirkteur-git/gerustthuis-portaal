<script setup>
</script>

<template>
  <div class="space-y-4" style="max-width: 800px;">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Patronen</h1>
      <p class="text-gray-500">Analyse van activiteitspatronen</p>
    </div>

    <!-- Work in Progress Card -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
      <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      <h2 class="text-xl font-semibold text-blue-900 mb-2">
        Hier zijn we nog mee bezig
      </h2>

      <p class="text-blue-700 mb-4 max-w-md mx-auto">
        We verzamelen eerst meer data om betrouwbare patronen te kunnen herkennen.
        Zodra we genoeg informatie hebben, verschijnen hier inzichten over het dagritme.
      </p>

      <div class="bg-white/50 rounded-lg p-4 max-w-sm mx-auto">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div class="text-left">
            <p class="text-sm font-medium text-blue-900">Minimaal 7 dagen nodig</p>
            <p class="text-xs text-blue-600">voor betrouwbare patroonherkenning</p>
          </div>
        </div>
      </div>
    </div>

    <!-- What to expect -->
    <div class="bg-white rounded-xl shadow-sm border p-6">
      <h3 class="font-semibold text-gray-900 mb-4">Wat kun je straks verwachten?</h3>

      <ul class="space-y-3">
        <li class="flex items-start gap-3">
          <div class="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">Dagritme inzichten</p>
            <p class="text-sm text-gray-500">Wanneer staat ze normaal op? Wanneer gaat ze naar bed?</p>
          </div>
        </li>

        <li class="flex items-start gap-3">
          <div class="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">Vergelijking met normaal</p>
            <p class="text-sm text-gray-500">Is vandaag een normale dag of wijkt het af?</p>
          </div>
        </li>

        <li class="flex items-start gap-3">
          <div class="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900">Activiteit trends</p>
            <p class="text-sm text-gray-500">Hoe ontwikkelt de activiteit zich over tijd?</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
