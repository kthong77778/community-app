import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, apiRequest } from "@/api/client";
import type { Offer, ProductView } from "@/api/types";
import { colors, productEmoji, radius, won } from "@/theme";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [product, setProduct] = useState<ProductView | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    "loading",
  );

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ product: ProductView; offers: Offer[] }>(
        `/api/products/${id}`,
      );
      setProduct(data.product);
      setOffers(data.offers);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setStatus("notfound");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (status === "notfound" || !product) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>상품을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: product.name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroEmoji]}>
            <Text style={{ fontSize: 76 }}>{productEmoji(product.category)}</Text>
          </View>
        )}

        <View style={styles.detail}>
          <View style={styles.top}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{product.brand}</Text>
            </View>
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>
                {productEmoji(product.category)} {product.category}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{product.name}</Text>
          {product.offerCount > 0 && (
            <Text style={styles.price}>
              최저 {won(product.lowestPrice)}
            </Text>
          )}
          {product.description ? (
            <Text style={styles.desc}>{product.description}</Text>
          ) : null}

          <Text style={styles.sectionTitle}>가격 비교</Text>
          {offers.length === 0 ? (
            <Text style={styles.emptyOffers}>
              아직 등록된 판매처가 없어요.
            </Text>
          ) : (
            <View style={styles.offerList}>
              {offers.map((offer, idx) => {
                const cheapest = idx === 0;
                const disabled = !offer.url;
                return (
                  <View key={offer.id} style={styles.offerRow}>
                    <View style={styles.offerInfo}>
                      <View style={styles.offerShopRow}>
                        <Text style={styles.offerShop} numberOfLines={1}>
                          {offer.shop}
                        </Text>
                        {cheapest && (
                          <View style={styles.lowBadge}>
                            <Text style={styles.lowBadgeText}>최저가</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.offerPrice, cheapest && styles.offerPriceLow]}
                      >
                        {won(offer.price)}
                      </Text>
                    </View>
                    <Pressable
                      disabled={disabled}
                      onPress={() => {
                        if (offer.url) void Linking.openURL(offer.url);
                      }}
                      style={[styles.buyBtn, disabled && styles.buyBtnDisabled]}
                    >
                      <Text
                        style={[
                          styles.buyText,
                          disabled && styles.buyTextDisabled,
                        ]}
                      >
                        구매하러 가기
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  scroll: { padding: 16, paddingBottom: 48 },
  hero: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  heroEmoji: { alignItems: "center", justifyContent: "center" },
  detail: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 20,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.primaryStrong },
  catChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: colors.surface2,
  },
  catChipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  price: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 4 },
  desc: { fontSize: 15, color: colors.text, lineHeight: 23, marginTop: 14 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 22,
    marginBottom: 10,
  },
  emptyOffers: { fontSize: 14, color: colors.textMuted, paddingVertical: 8 },
  offerList: { gap: 10 },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    padding: 12,
  },
  offerInfo: { flex: 1 },
  offerShopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  offerShop: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
  lowBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  lowBadgeText: { fontSize: 10.5, fontWeight: "800", color: colors.primaryText },
  offerPrice: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 4 },
  offerPriceLow: { color: colors.primaryStrong },
  buyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buyBtnDisabled: { backgroundColor: colors.border },
  buyText: { color: colors.primaryText, fontWeight: "700", fontSize: 13 },
  buyTextDisabled: { color: colors.textMuted },
  muted: { color: colors.textMuted, fontSize: 14 },
});
