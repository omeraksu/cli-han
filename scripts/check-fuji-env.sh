#!/usr/bin/env bash
set -a; source .env; set +a

mask() {
  local v="$1"
  [ -z "$v" ] && { echo "MISSING"; return; }
  local n=${#v}
  if [ "$n" -le 8 ]; then echo "<set,short:$n>"; else echo "${v:0:6}…${v: -4} (len=$n)"; fi
}

echo "deployer_pk:     $(mask "$DEPLOYER_PRIVATE_KEY")"
echo "avax_rpc_url:    $(mask "$AVAX_RPC_URL")"
echo "fee_receiver:    $(mask "$HAN_FEE_RECEIVER_ADDRESS")"
echo "hub_authority:   $(mask "$HUB_AUTHORITY_ADDRESS")"
echo "snowtrace_key:   $(mask "$SNOWTRACE_API_KEY")"
echo "fee_bps:         ${HAN_FEE_BPS:-300 (default)}"

echo "---"
echo "keys defined in .env (no values shown):"
awk -F= '/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=/{
  gsub(/[[:space:]]/, "", $1); print "  - " $1
}' .env

if [ -n "$DEPLOYER_PRIVATE_KEY" ] && [ -n "$AVAX_RPC_URL" ]; then
  addr=$(cast wallet address "$DEPLOYER_PRIVATE_KEY" 2>/dev/null)
  echo "---"
  echo "deployer_addr:   ${addr:-<derive failed>}"
  if [ -n "$addr" ]; then
    bal=$(cast balance "$addr" --rpc-url "$AVAX_RPC_URL" --ether 2>/dev/null)
    echo "fuji_balance:    ${bal:-<rpc failed>} AVAX"
  fi
fi
