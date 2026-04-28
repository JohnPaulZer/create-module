<template>
  <DashboardPanel />
</template>

<script setup lang="ts">
import DashboardPanel from "../components/DashboardPanel.vue";
import { useDashboard } from "../composables/useDashboard";

const dashboard = useDashboard();
dashboard.loadDashboard();
</script>
