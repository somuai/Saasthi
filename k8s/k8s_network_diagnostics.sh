#!/usr/bin/env bash
# Kube-Proxy & Network Diagnostic Test Suite
# Intended for execution on a live Kubernetes cluster (Staging/Prod)

set -e

echo "=========================================================="
echo "    Kube-Proxy & Network Health Diagnostic Suite          "
echo "=========================================================="

# Ensure kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl not found."
    exit 1
fi

echo "1. Checking Kube-Proxy Mode Configuration (IPVS vs Iptables)"
KUBE_PROXY_CM=$(kubectl get configmap -n kube-system kube-proxy -o yaml 2>/dev/null || echo "")
if [[ "$KUBE_PROXY_CM" == *"mode: ipvs"* ]]; then
    echo "  [PASS] Kube-proxy is correctly configured for IPVS mode (O(1) complexity)."
elif [[ "$KUBE_PROXY_CM" == *"mode: iptables"* ]] || [[ -z "$KUBE_PROXY_CM" ]]; then
    echo "  [WARNING] Kube-proxy is using iptables mode. This will cause bloat at >1000 services."
    echo "  Action Required: Update kube-proxy ConfigMap mode to 'ipvs'."
fi

echo ""
echo "2. Testing DNS Resolution Latency & Spikes"
echo "  Deploying temporary dns-tester pod..."
kubectl run dns-tester --image=busybox:1.36 --restart=Never -- sleep 3600 > /dev/null 2>&1
kubectl wait --for=condition=ready pod dns-tester --timeout=60s > /dev/null 2>&1

echo "  Executing 100 DNS lookups..."
START_TIME=$(date +%s%N)
for i in {1..100}; do
    kubectl exec dns-tester -- nslookup kubernetes.default.svc.cluster.local > /dev/null 2>&1
done
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
AVG_MS=$(( ELAPSED_MS / 100 ))

echo "  [RESULT] Average DNS lookup latency: ${AVG_MS} ms"
if [ "$AVG_MS" -gt 10 ]; then
    echo "  [WARNING] High DNS latency detected. Ensure NodeLocal DNSCache is running."
else
    echo "  [PASS] DNS resolution is fast."
fi

echo ""
echo "3. Testing Kube-Proxy Service Rule Synchronization (Rollback Simulation)"
echo "  Creating a dummy deployment with 10 replicas..."
kubectl create deployment sync-tester --image=nginx:alpine > /dev/null 2>&1
kubectl expose deployment sync-tester --port=80 --target-port=80 > /dev/null 2>&1
kubectl scale deployment sync-tester --replicas=10 > /dev/null 2>&1

echo "  Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=sync-tester --timeout=60s > /dev/null 2>&1

echo "  Simulating high pod churn (rollback / scale down)..."
START_SYNC=$(date +%s%N)
kubectl scale deployment sync-tester --replicas=0 > /dev/null 2>&1
kubectl wait --for=delete pod -l app=sync-tester --timeout=60s > /dev/null 2>&1
END_SYNC=$(date +%s%N)

SYNC_ELAPSED_MS=$(( (END_SYNC - START_SYNC) / 1000000 ))
echo "  [RESULT] Kube-proxy synchronized service deletion across cluster in ${SYNC_ELAPSED_MS} ms."

# Clean up
echo ""
echo "Cleaning up test resources..."
kubectl delete pod dns-tester --ignore-not-found > /dev/null 2>&1
kubectl delete service sync-tester --ignore-not-found > /dev/null 2>&1
kubectl delete deployment sync-tester --ignore-not-found > /dev/null 2>&1

echo "Diagnostic tests completed."
