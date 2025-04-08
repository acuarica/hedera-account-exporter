package de.devlodge.hedera.account.export.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record Transaction(Network network, UUID id, String networkId, Instant timestamp, BigDecimal amount,
                          boolean isStakingReward, BigDecimal balanceAfterTransaction, String accountId){}
