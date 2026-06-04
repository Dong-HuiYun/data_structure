#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

// 定義堆疊節點與堆疊結構 (參照資料中的 Stack ADT)
typedef struct node {
    char data;
    struct node* link;
} STACK_NODE;

typedef struct {
    int count;
    STACK_NODE* top;
} STACK;

// 建立空堆疊
STACK* createStack(void) {
    STACK* stack = (STACK*)malloc(sizeof(STACK));
    if (stack) {
        stack->count = 0;
        stack->top = NULL;
    }
    return stack;
}

// Push 操作
bool pushStack(STACK* stack, char dataIn) {
    STACK_NODE* newPtr = (STACK_NODE*)malloc(sizeof(STACK_NODE));
    if (!newPtr) return false;
    newPtr->data = dataIn;
    newPtr->link = stack->top;
    stack->top = newPtr;
    (stack->count)++;
    return true;
}

// Pop 操作
char popStack(STACK* stack) {
    if (stack->count == 0) return '\0';
    STACK_NODE* temp = stack->top;
    char dataOut = temp->data;
    stack->top = stack->top->link;
    free(temp);
    (stack->count)--;
    return dataOut;
}

bool emptyStack(STACK* stack) {
    return (stack->count == 0);
}

// 驗證左右括號是否為同一種類型
bool isMatchingPair(char char1, char char2) {
    if (char1 == '(' && char2 == ')') return true;
    else if (char1 == '{' && char2 == '}') return true;
    else if (char1 == '[' && char2 == ']') return true;
    else return false;
}

// 核心演算法：解析並驗證語法標籤
bool parseParens(char* expression) {
    STACK* stack = createStack();
    int i = 0;

    while (expression[i] != '\0') {
        char token = expression[i];

        // 遇到左括號，Push 進堆疊
        if (token == '{' || token == '(' || token == '[') {
            pushStack(stack, token);
        }
        // 遇到右括號，Pop 出堆疊頂端進行比對
        else if (token == '}' || token == ')' || token == ']') {
            if (emptyStack(stack)) {
                printf("錯誤：結尾括號 '%c' 找不到匹配的起始括號 (在字元 %d)\n", token, i + 1);
                return false;
            }
            char poppedChar = popStack(stack);
            if (!isMatchingPair(poppedChar, token)) {
                printf("錯誤：括號不匹配。預期為配對括號，但得到 '%c' 和 '%c' (在字元 %d)\n", poppedChar, token, i + 1);
                return false;
            }
        }
        i++;
    }

    // 檢查堆疊是否還有殘留的左括號
    if (!emptyStack(stack)) {
        printf("錯誤：遺失結尾括號，有未閉合的起始括號。\n");
        return false;
    }

    return true;
}

int main(void) {
    printf("=== 智慧合約語法括號驗證系統 ===\n");

    // 測試案例 1: 正確匹配
    char expr1[] = "function test() { if(a==1) { return; } }";
    printf("\n測試字串 1: %s\n", expr1);
    if (parseParens(expr1)) {
        printf("結果: 語法驗證成功 (Parsing is OK)!\n");
    }

    // 測試案例 2: 括號不匹配
    char expr2[] = "function error() { array[1} = 0; }";
    printf("\n測試字串 2: %s\n", expr2);
    if (parseParens(expr2)) {
        printf("結果: 語法驗證成功 (Parsing is OK)!\n");
    }

    // 測試案例 3: 遺失結尾括號
    char expr3[] = "while(true) { execute(";
    printf("\n測試字串 3: %s\n", expr3);
    if (parseParens(expr3)) {
        printf("結果: 語法驗證成功 (Parsing is OK)!\n");
    }

    return 0;
}
