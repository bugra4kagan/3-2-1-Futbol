package com.futbol321.challenge;

import androidx.annotation.NonNull;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gerçek Android Google Play Billing Library v7 (com.android.billingclient:billing:7.1.1)
 * Capacitor eklentisi.
 * Desteklenen işlemler:
 *  - queryProducts: Google Play Console'daki gerçek INAPP fiyatları ve para birimini çeker
 *  - launchBillingFlow: Play Store ödeme penceresini açar ve PURCHASED / PENDING / CANCELED durumlarını döner
 *  - acknowledgeOrConsumePurchase: Sunucu doğrulamasından sonra satın alımı onaylar (acknowledge/consume)
 *  - queryOwnedPurchases: Satın Alımları Geri Yükle (Restore Purchases) için aktif INAPP sahipliklerini listeler
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;
    private final Map<String, ProductDetails> cachedProductDetails = new ConcurrentHashMap<>();

    @Override
    public void load() {
        ensureBillingClient();
    }

    private synchronized BillingClient ensureBillingClient() {
        if (billingClient == null) {
            billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(
                    PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
                )
                .build();
        }
        return billingClient;
    }

    private void withConnectedClient(Runnable onReady, PluginCall callToReject) {
        BillingClient client = ensureBillingClient();
        if (client.isReady()) {
            onReady.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onReady.run();
                } else {
                    if (callToReject != null) {
                        JSObject err = new JSObject();
                        err.put("ok", false);
                        err.put("status", "SERVICE_UNAVAILABLE");
                        err.put("responseCode", result.getResponseCode());
                        err.put("message", result.getDebugMessage());
                        callToReject.resolve(err);
                    }
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Bir sonraki çağrıda startConnection otomatik yeniden bağlanır
            }
        });
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        JSArray productIdsArray = call.getArray("productIds");
        if (productIdsArray == null || productIdsArray.length() == 0) {
            JSObject empty = new JSObject();
            empty.put("ok", true);
            empty.put("products", new JSArray());
            call.resolve(empty);
            return;
        }

        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        for (int i = 0; i < productIdsArray.length(); i++) {
            String pid = productIdsArray.optString(i, "").trim();
            if (!pid.isEmpty()) {
                productList.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(pid)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                );
            }
        }

        if (productList.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("ok", true);
            empty.put("products", new JSArray());
            call.resolve(empty);
            return;
        }

        withConnectedClient(() -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();
            ensureBillingClient().queryProductDetailsAsync(params, (result, productDetailsList) -> {
                JSObject response = new JSObject();
                JSArray items = new JSArray();
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && productDetailsList != null) {
                    for (ProductDetails pd : productDetailsList) {
                        cachedProductDetails.put(pd.getProductId(), pd);
                        JSObject row = new JSObject();
                        row.put("productId", pd.getProductId());
                        row.put("title", pd.getTitle());
                        row.put("description", pd.getDescription());
                        ProductDetails.OneTimePurchaseOfferDetails offer = pd.getOneTimePurchaseOfferDetails();
                        if (offer != null) {
                            row.put("formattedPrice", offer.getFormattedPrice());
                            row.put("priceCurrencyCode", offer.getPriceCurrencyCode());
                            row.put("priceAmountMicros", offer.getPriceAmountMicros());
                        }
                        items.put(row);
                    }
                    response.put("ok", true);
                    response.put("products", items);
                } else {
                    response.put("ok", false);
                    response.put("responseCode", result.getResponseCode());
                    response.put("message", result.getDebugMessage());
                    response.put("products", items);
                }
                call.resolve(response);
            });
        }, call);
    }

    @PluginMethod
    public void launchBillingFlow(PluginCall call) {
        String productId = call.getString("productId", "").trim();
        String obfuscatedAccountId = call.getString("obfuscatedAccountId", "").trim();

        if (productId.isEmpty()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("status", "INVALID_PRODUCT");
            err.put("message", "Geçersiz ürün kimliği.");
            call.resolve(err);
            return;
        }

        synchronized (this) {
            if (pendingPurchaseCall != null) {
                JSObject busy = new JSObject();
                busy.put("ok", false);
                busy.put("status", "BILLING_IN_PROGRESS");
                busy.put("message", "Devam eden bir satın alma işlemi zaten var.");
                call.resolve(busy);
                return;
            }
            pendingPurchaseCall = call;
        }

        withConnectedClient(() -> {
            Runnable startFlowWithDetails = () -> {
                ProductDetails pd = cachedProductDetails.get(productId);
                if (pd == null) {
                    resolvePendingPurchaseError("ITEM_UNAVAILABLE", "Ürün Google Play Console'da bulunamadı veya aktif değil.");
                    return;
                }
                BillingFlowParams.ProductDetailsParams pdParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(pd)
                    .build();
                BillingFlowParams.Builder flowBuilder = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(pdParams));
                if (!obfuscatedAccountId.isEmpty()) {
                    flowBuilder.setObfuscatedAccountId(obfuscatedAccountId);
                }
                if (getActivity() == null) {
                    resolvePendingPurchaseError("NO_ACTIVITY", "Ödeme penceresi açılamadı.");
                    return;
                }
                getActivity().runOnUiThread(() -> {
                    BillingResult launchResult = ensureBillingClient().launchBillingFlow(getActivity(), flowBuilder.build());
                    if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        resolvePendingPurchaseError(
                            mapResponseCode(launchResult.getResponseCode()),
                            launchResult.getDebugMessage()
                        );
                    }
                });
            };

            if (cachedProductDetails.containsKey(productId)) {
                startFlowWithDetails.run();
            } else {
                QueryProductDetailsParams queryParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        Collections.singletonList(
                            QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(productId)
                                .setProductType(BillingClient.ProductType.INAPP)
                                .build()
                        )
                    )
                    .build();
                ensureBillingClient().queryProductDetailsAsync(queryParams, (result, list) -> {
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                        for (ProductDetails pd : list) {
                            cachedProductDetails.put(pd.getProductId(), pd);
                        }
                    }
                    startFlowWithDetails.run();
                });
            }
        }, call);
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        PluginCall activeCall;
        synchronized (this) {
            activeCall = pendingPurchaseCall;
            pendingPurchaseCall = null;
        }
        if (activeCall == null) return;

        int code = billingResult.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject canceled = new JSObject();
            canceled.put("ok", false);
            canceled.put("status", "USER_CANCELED");
            canceled.put("message", "Satın alma kullanıcı tarafından iptal edildi.");
            activeCall.resolve(canceled);
            return;
        }

        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            JSObject owned = new JSObject();
            owned.put("ok", false);
            owned.put("status", "ITEM_ALREADY_OWNED");
            owned.put("message", "Bu ürün zaten Google Play hesabında aktif.");
            activeCall.resolve(owned);
            return;
        }

        if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("status", mapResponseCode(code));
            err.put("responseCode", code);
            err.put("message", billingResult.getDebugMessage());
            activeCall.resolve(err);
            return;
        }

        Purchase p = purchases.get(0);
        int state = p.getPurchaseState();
        JSObject res = new JSObject();
        res.put("ok", state == Purchase.PurchaseState.PURCHASED);
        res.put(
            "status",
            state == Purchase.PurchaseState.PURCHASED
                ? "PURCHASED"
                : state == Purchase.PurchaseState.PENDING
                    ? "PENDING"
                    : "UNSPECIFIED"
        );
        res.put("purchaseToken", p.getPurchaseToken());
        res.put("orderId", p.getOrderId());
        res.put("acknowledged", p.isAcknowledged());
        JSArray productIds = new JSArray();
        for (String pid : p.getProducts()) {
            productIds.put(pid);
        }
        res.put("productIds", productIds);
        activeCall.resolve(res);
    }

    @PluginMethod
    public void acknowledgeOrConsumePurchase(PluginCall call) {
        String purchaseToken = call.getString("purchaseToken", "").trim();
        boolean consumable = Boolean.TRUE.equals(call.getBoolean("consumable", false));
        if (purchaseToken.isEmpty()) {
            call.reject("MISSING_PURCHASE_TOKEN");
            return;
        }

        withConnectedClient(() -> {
            if (consumable) {
                ConsumeParams consumeParams = ConsumeParams.newBuilder()
                    .setPurchaseToken(purchaseToken)
                    .build();
                ensureBillingClient().consumeAsync(consumeParams, (result, outToken) -> {
                    JSObject res = new JSObject();
                    res.put("ok", result.getResponseCode() == BillingClient.BillingResponseCode.OK);
                    res.put("responseCode", result.getResponseCode());
                    res.put("purchaseToken", outToken);
                    call.resolve(res);
                });
            } else {
                AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchaseToken)
                    .build();
                ensureBillingClient().acknowledgePurchase(ackParams, result -> {
                    JSObject res = new JSObject();
                    res.put("ok", result.getResponseCode() == BillingClient.BillingResponseCode.OK);
                    res.put("responseCode", result.getResponseCode());
                    call.resolve(res);
                });
            }
        }, call);
    }

    @PluginMethod
    public void queryOwnedPurchases(PluginCall call) {
        withConnectedClient(() -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
            ensureBillingClient().queryPurchasesAsync(params, (result, purchaseList) -> {
                JSObject response = new JSObject();
                JSArray owned = new JSArray();
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchaseList != null) {
                    for (Purchase p : purchaseList) {
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                            JSObject item = new JSObject();
                            item.put("purchaseToken", p.getPurchaseToken());
                            item.put("orderId", p.getOrderId());
                            item.put("acknowledged", p.isAcknowledged());
                            item.put("purchaseTime", p.getPurchaseTime());
                            JSArray pids = new JSArray();
                            for (String pid : p.getProducts()) {
                                pids.put(pid);
                            }
                            item.put("productIds", pids);
                            owned.put(item);
                        }
                    }
                    response.put("ok", true);
                    response.put("purchases", owned);
                } else {
                    response.put("ok", false);
                    response.put("responseCode", result.getResponseCode());
                    response.put("purchases", owned);
                }
                call.resolve(response);
            });
        }, call);
    }

    private void resolvePendingPurchaseError(String status, String message) {
        PluginCall activeCall;
        synchronized (this) {
            activeCall = pendingPurchaseCall;
            pendingPurchaseCall = null;
        }
        if (activeCall == null) return;
        JSObject err = new JSObject();
        err.put("ok", false);
        err.put("status", status);
        err.put("message", message);
        activeCall.resolve(err);
    }

    private String mapResponseCode(int code) {
        switch (code) {
            case BillingClient.BillingResponseCode.USER_CANCELED:
                return "USER_CANCELED";
            case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED:
                return "ITEM_ALREADY_OWNED";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE:
                return "ITEM_UNAVAILABLE";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR:
                return "DEVELOPER_ERROR";
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE:
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
                return "SERVICE_UNAVAILABLE";
            default:
                return "BILLING_ERROR_" + code;
        }
    }
}
