<template>
  <DashboardPanel />
</template>

<script setup lang="ts">
import DashboardPanel from "../../components/dashboard/DashboardPanel.vue";
import { useDashboard } from "../../composables/dashboard/useDashboard";

const dashboard = useDashboard();
dashboard.loadDashboard();
</script>
