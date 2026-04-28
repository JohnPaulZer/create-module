<?php

namespace App\Services\Account;

use App\Models\Account\Account;

class AccountService
{
    public function all(): array
    {
        return [Account::class];
    }
}
